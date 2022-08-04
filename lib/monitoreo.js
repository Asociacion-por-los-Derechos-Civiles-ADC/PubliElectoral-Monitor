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
var accountPacks = [];


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
        console.log(`Image: ${path} from post: ${post.id} saved succesfuly!`);
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


const savePack = (data, filename) => {
    var file = fs.createWriteStream(`./${filename}`);
    file.on('error', function(err) { console.log('ERROR AL GUARDAR BUFFER: ', err) });
    // console.log('DATA ', data)
    data.forEach(function(v) { file.write(v.join(', ') + '\n'); });
    file.end();
    logger(`${filename} actualizado.`)
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


const makePacks = (accounts, count) => {
    logger(`Cantidad de cuentas por paquete: ${count}`);
    let temp = [];
    let lsCopy = new Array(...accounts);
    let packs = accounts.reduce((acc, account, idx,_) => {
        if (temp.length < count) {
            temp.push(account);
            lsCopy.shift(idx);
            return acc;
        }
        acc.push(temp);
        temp = [account];
        lsCopy.shift(idx);
        if (accounts.length%2 === 1) {
            if (lsCopy.length === 0 && temp.length >= 1) {
                acc.push(temp);
            }
            if (lsCopy.length === 2 && temp.length === 1) {
                acc.push(temp.concat(lsCopy));
            }
        } else if (lsCopy.length <= 2 && temp.length === 1) {
            acc.push(temp.concat(lsCopy));
        } else {
            acc.push(temp.concat(lsCopy));
        }
        return acc;
    }, []);
    logger(`Paquetes generados: ${packs.length}`);
    return packs;
};


const generatePackAccounts = async (accounts, count, campaign) => {
    let packAccounts = [];
    const filename = `accountBuffer-${campaign.name}`
    try {
        if (fs.existsSync(`./${filename}`)) {
            packAccounts = fs.createReadStream(filename);
        } else {
            logger(`No existe el archivo: ${filename} donde almacenar las cuentas. Se inicializa un archivo vacío.`);
        }
    } catch (error) {
        console.error(`Error al querer buscar el archivo "${filename}": `, error);
    };
    logger(`Packs de cuentas restantes a procesar: ${packAccounts.length} en ${filename}`);
    if (packAccounts.length !== 0) {
        currentPack = packAccounts[0];
        console.log('packkk  ', packAccounts)
        packAccounts.splice(0, 1);
        savePack(packAccounts, filename);
        return currentPack
    } else {
        accountPacks = makePacks(accounts, count);
        currentPack = accountPacks.length !== 0 ? accountPacks[0] : [];
        accountPacks.splice(0, 1);
        savePack(accountPacks, filename);
        return currentPack
    }
    // packAccounts = accountPacks.length !== 0 ? accountPacks[0] : makePacks(accounts, count);
    // accountPacks.splice(0, 1);
    // savePack(accountPacks, filename);
    // return packAccounts;
};


const databaseConnection = () => {
     mongoose.connect(`mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}/${process.env.DB_NAME}`, {useNewUrlParser: true});
};


const logger = (str) => console.log(str);


const getAccountsByCampaing = async (campaign) => {
    const response = await Account.find({'campaigns': campaign._id});
    response.length === 0 ?
        logger(`No hay cuentas con la campaña ${campaign.name} configurada.`) :
        logger(`Cantidad total de cuentas: ${response.length} para la campaña: ${campaign.name}`);
    return response;
};


const existLastPostInDatabase = async (account) => {
    const post = await Post.findOne({'fbAccountId': account.fbAccountId}).sort('-publicDate');
    let lasPostDate = post ? post.publicDate : null;
    logger(`Último post guardado de ${account.name} es el del día: ${lasPostDate}`);
    return lasPostDate;
};


const getPostFromFacebook = async (facebookAPI, account, accountCampaign, lastPostDate) => {
    try {
        const posts = await facebookAPI.getPosts(account, accountCampaign.startDate, accountCampaign.endDate, lastPostDate);
        if (posts) {
            await posts.forEach(async (p) => {
                const post = p.data
                if (post.full_picture) {
                    const tmpURL = `img/tmp/${post.id}`;
                    await downloadImage(post.full_picture, tmpURL);
                    moveImage(tmpURL, post, accountCampaign);
                }
                const newPost = new Post({
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
                try {
                    const savedPost = await newPost.save();
                    logger(`Se guardó el post: ${savedPost._id} en la base de datos.`);
                } catch (error) {
                    logger(`Fallo al intentar guardar el post en la base de datos. Error: ${error} Post: ${post}`);
                }
            });
        }        
    } catch (error) {
        console.log('erorrr ',error)
        // logger(`Fallo al querer traer los post de ${account.name} desde Facebook para la campaña ${accountCampaign.name}`);
    }
};


const checkPosts = async (facebookAPI, accountBuffer) => {
    databaseConnection();
    let currentDate = new Date();
    // Verificación si el script esta ejecutando en un periodo de campaña.
    const campaigns = await Campaign.find({
        'startDate': {'$lte': currentDate},
        'endDate': {'$gte': currentDate}
    });
    logger(
        `--------------------------------------------------
        \nInicio script de publicaciones el ${currentDate.toLocaleString()}
        \nSe encontraron ${campaigns.length} campañas activas.`
    );
    if (campaigns.length >= 1) {
        campaigns.forEach(async (campaign) => {
            logger(
                `--------------------------------------------------
                \nCampaña: ${campaign.name}
                \nFecha de inicio: ${campaign.startDate.toUTCString()}
                \nFecha de fin: ${campaign.endDate.toUTCString()}`
            );
            // obtener todas las cuentas a monitorear.
            const accountsResponse = await getAccountsByCampaing(campaign);
            const pack = await generatePackAccounts(accountsResponse, 4, campaign);
            // packs.forEach(async (pack) => {
                pack.forEach(async(account) => {
                    const accountCampaign = await getCurrentCampaignOfAnAccount(account, currentDate);
                    logger(`Fetching cuenta: ${account.name} en campaña: ${accountCampaign.name}`);
                    const lastPostDate = await existLastPostInDatabase(account);
                    await getPostFromFacebook(
                        facebookAPI,
                        account,
                        accountCampaign,
                        lastPostDate
                    );
                });
            // });
        });
    };
};

module.exports = {
    checkPosts,
};