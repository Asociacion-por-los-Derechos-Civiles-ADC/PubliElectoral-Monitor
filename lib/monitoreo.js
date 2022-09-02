require('dotenv').load();

const axios = require('axios');
const crypto = require('crypto');
const mongoose = require('mongoose');
const fs = require('fs');
Promise           = require('bluebird');
mongoose.Promise  = Promise;

const Account = require('../models/account');
const Campaign = require('../models/campaign');
const Post = require('../models/post');
const Error = require('../models/errors');
const Queue = require('../models/queues');


const isApiLimitError = (error) =>  error.is_transient && 
                                    error.type === 'OAuthException' && 
                                    (error.code === 4 || error.code === 2 ) && 
                                    (error.message.includes('Application request limit reached') || error.message.includes('Please retry your request later'));


const analyzeError = async (err, account, campaign, campaignQueue) => {
    const error = err.response.data.error;
    logger(`\nAnalizando Error de Cuenta: ${account.name}  Campaña: ${campaign.name} de ${campaign._doc.country}
    \n    * Error data: ${JSON.stringify(error)}`);

    if (isApiLimitError(error)) {
        // Error por llegar al limite en la API Graph.
        // Marcar cuenta como no procesada.
        account.processed = false;
        account.save();
    } else {
        // Si falla por otra cosa, como ID inválido o que esta mal algún dato, se marca como procesada
        // ya que si se gasto cuota en la API Graph.
        markAccountAsProcessed(account, campaign, campaignQueue, true);
    }
    const newError = new Error({
        'account': account.name,
        'fbAccountId': account.fbAccountId,
        'message': error.message,
        'type': error.type,
        'error_subcode': error.error_subcode,
        'code': error.code,
        'date': new Date()
    })
    newError.save()
}


const markAccountAsProcessed = (account, accountCampaign, campaignQueue, quarentine=false, totalPost=0) => {
    const accountIdx = campaignQueue.nonProcessed.indexOf(account);
    const accountProcessed = campaignQueue.nonProcessed.splice(accountIdx, 1);
    account.lastDateProcessed = new Date();
    if (!quarentine) {
        // cuando se reinician las procesadas a no procesadas cambiar 'processed' a false
        account.processed = true;
        account.lastTotalPostSaved = totalPost;
        account.save();
        // actualizar la lista de procesados de la queue.
        campaignQueue.processed.push(accountProcessed[0]);
    } else {
        account.save();
        // El lastDateProcessed en el caso de cuarentena marca la fecha que entro en cuarentena la cuenta
        campaignQueue.quarentine.push(account);
    }
}


const getCurrentCampaignOfAnAccount = async (account, currentDate) => {
    const accountCampaigns = account.campaigns;
    const campaign = await Campaign.findOne({
        $and: [
            {
                'startDate': {'$lte': currentDate},
                'endDate': {'$gte': currentDate}
            },
            {
                '_id': {$in: accountCampaigns}
            }
        ]
    });
    return campaign;
};


const updateImageChecksum = async (post, path) => {
    const posts = await Post.find({'fbPostId': post.id});
    posts.map(async (savedPost) => {
        savedPost.localImgUrl = path;
        await savedPost.save();
        logger(`Image: ${path} from post: ${post.id} saved succesfuly!`);
    });
};


const generateChecksum = (str) => crypto.createHash('md5').update(str, 'utf8').digest('hex');


const moveImage = async (tmpURL, post, campaign) => {
    fs.readFile(tmpURL, (err, data) => {
        if (err) { console.log(err) }
        else {
            const checksum = generateChecksum(data);
            post.image_checksum = checksum;
            const newPath = `/img/campaigns/${campaign._id}/uncategorized/`;
            fs.mkdir(process.env.MEDIA_DIR + newPath, { recursive: true }, (err) => {
                err ? console.log(err) :
                fs.rename(tmpURL, process.env.MEDIA_DIR + newPath + checksum + '.jpg', (err) => {
                    err ? console.log(err) :
                    updateImageChecksum(post, newPath + checksum + '.jpg')
                });
            });
        }
    });
};


const downloadImage = async (url, image_path) => {
    const response = await axios({url, responseType: 'stream'});
    new Promise((resolve, reject) => {
        response.data
            .pipe(fs.createWriteStream(image_path))
            .on('finish', () => resolve())
            .on('error', (e) => reject(e));
    });
};


const databaseConnection = () => {
     mongoose.connect(`mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}/${process.env.DB_NAME}`, {useNewUrlParser: true});
};


const logger = (str) => console.log(str);


const getAccountsByCampaing = async (campaign, onlyCount=false) => {
    const response = await Account.find({'campaigns': campaign._id}).sort('lastDateProcessed');
    return onlyCount ? response.length : response;
};


const existLastPostInDatabase = async (account) => {
    const post = await Post.findOne({'fbAccountId': account.fbAccountId}).sort('-publicDate');
    let lasPostDate = post ? post.publicDate : null;
    const stringDate = lasPostDate ? lasPostDate.toLocaleString('es-AR') : 'No se encontro';
    logger(`   * Último post guardado de ${account.name}:  ${stringDate}`);
    return lasPostDate;
};


const makePost = (post, account, accountCampaign) => new Post({
    text: post.message,
    publicDate: post.created_time,
    image: post.full_picture,
    postLink: `https://www.facebook.com/${post.id}`,
    fbPostId: post.id,
    account: account._id,
    fbAccountId: account.fbAccountId,
    campaign: accountCampaign._id,
    politicalParty: account.politicalParty,
});


const getPostFromFacebook = async (facebookAPI, account, accountCampaign, lastPostDate, campaignQueue) => {
    let postsSaved = 0;
    try {
        const posts = await facebookAPI.getPosts(account, accountCampaign.startDate, accountCampaign.endDate, lastPostDate);
        if (posts) {
            logger(
                `Se obtuvieron finalmente ${posts.length} publicaciones con detalles de ${account.name} de ${accountCampaign._doc.country}`
            )
            await posts.forEach(
                async (p) => {
                    const post = p.data;
                    if (post.full_picture) {
                        const tmpURL = `img/tmp/${post.id}`;
                        await downloadImage(post.full_picture, tmpURL);
                        moveImage(tmpURL, post, accountCampaign);
                    }
                    const newPost = makePost(post, account, accountCampaign);
                    try {
                        const savedPost = await newPost.save();
                        logger(`   * Se guardó el post: ${savedPost._id} en la base de datos.`);
                        postsSaved = postsSaved +1;
                    } catch (error) {
                        logger(`Fallo al intentar guardar el post en la base de datos. Error: ${error} Post: ${post}`);
                    }
                }
            );
            markAccountAsProcessed(account, accountCampaign, campaignQueue, totalPost=postsSaved);
        }        
    } catch (err) {
        analyzeError(err, account, accountCampaign, campaignQueue);
    }
};


const validCampaings = async (date) => {
    return await Campaign.find({
        'startDate': {'$lte': date},
        'endDate': {'$gte': date},
        'name': 'TEST Eleição presidencial' // Sacar trae solo campaña test brasil
    });
};


const getCampaignQueue = async (campaign) => {
    const queue = await Queue.findOne({ 'name': campaign.name });
    return queue !== null ? await queue.populate('nonProcessed').execPopulate() : queue;
};


const createCampaignQueue = async (campaign) => {
    const accounts = await getAccountsByCampaing(campaign);
    const newQueue = new Queue({
        'name': campaign.name,
        'processed': [],
        'nonProcessed': accounts,
        'totalAccounts': accounts.length,
        'quarentine': []
    });
    const queue = await newQueue.save();
    logger(`   * Queue ${newQueue.name} creada con éxito.`);
    return queue;
}


const verifyQueues = async (campaigns) => {
    const queues = [];
    await campaigns.forEach(
        async(campaign) => {
            queues.push(
                new Promise(async(resolve,_) => {
                    let campaingQueue = await getCampaignQueue(campaign);
                    if (!campaingQueue) {
                        campaingQueue = await createCampaignQueue(campaign);
                    }
                    resolve(campaingQueue);
                })
            );
        }
    );
    return await Promise.all(queues);
};


const updateQueue = async (queue) => {
    logger(
        `\n   * Queue: ${queue.name}
        \n        * Procesadas: ${queue.processed.length}
        \n        * No Procesadas: ${queue.nonProcessed.length}
        \n        * Cuarentena: ${queue.quarentine.length}
        \n        * Total: ${queue.totalAccounts}`
    );
    if (queue.processed.length <= queue.totalAccounts) {
        await queue.save();
        logger(`\n   * Queue ${queue.name} actualizada.`);
    }
};


const checkPosts = async (facebookAPI, _accountBuffer) => {
    databaseConnection();
    const currentDate = new Date();
    const campaigns = await validCampaings(currentDate);
    logger(
        `----------------------------------------------------------------------------------------------------
        \nInicio script de publicaciones el ${currentDate.toLocaleString('es-AR')}
        \nSe encontraron ${campaigns.length} campañas activas:`
    );
    if (campaigns.length >= 1) {
        const queues = await verifyQueues(campaigns);
        const campaingPromises = [];
        campaigns.forEach(
            async (campaign) => {
                campaingPromises.push(
                    new Promise(
                        async(resolve, _) => {
                            const campaignQueue = queues.find((q) => q.name === campaign.name);
                            logger(
                                `\n   * Campaña: ${campaign.name} en ${campaign._doc.country}
                                \n        * Fecha de inicio: ${campaign.startDate.toLocaleString('es-AR')}
                                \n        * Fecha de fin: ${campaign.endDate.toLocaleString('es-AR')}
                                \n        * Total de cuentas: ${campaignQueue.totalAccounts}`
                            );
                            // obtener todas las cuentas a monitorear.
                            const accounts = [] // campaignQueue.nonProcessed
                            campaignQueue.nonProcessed.forEach((c, idx) => { if (idx < 30) accounts.push(c); }); // Provisorio sacar limite de 30 cuentas por corrida

                            const processedPromises = [];
                            accounts.forEach(
                                async(account, idx) => {
                                    processedPromises.push(
                                        new Promise(
                                            async(resolve,_) => {
                                                const accountCampaign = await getCurrentCampaignOfAnAccount(account, currentDate);
                                                logger(`   * Procesando cuenta: ${account.name}   Campaña: ${accountCampaign.name} de ${accountCampaign._doc.country}`);
                                                const lastPostDate = await existLastPostInDatabase(account);
                                                resolve(
                                                    await getPostFromFacebook(
                                                        facebookAPI,
                                                        account,
                                                        accountCampaign,
                                                        lastPostDate,
                                                        campaignQueue
                                                    )
                                                );
                                            }
                                        )
                                    );
                                }
                            );
                            await Promise.all(processedPromises);
                            resolve(await updateQueue(campaignQueue));
                        }
                    )
                );
            
        });
        await Promise.all(campaingPromises);
        logger(
            `\nFin de ejecución del script: ${new Date().toLocaleString('es-AR')}
            \n----------------------------------------------------------------------------------------------------`
        )
    };
};

module.exports = {
    checkPosts,
    analyzeError,
    markAccountAsProcessed
};
