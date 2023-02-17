'use strict';
require('dotenv').load();

const axios       = require('axios');
const crypto      = require('crypto');
const fs          = require('fs');
const mongoose    = require('mongoose');
Promise           = require('bluebird');
mongoose.Promise  = Promise;

const Account     = require('../models/account');
const Campaign    = require('../models/campaign');
const Post        = require('../models/post');
const Error       = require('../models/errors');
const singleFbApi = require('./single-facebook-api');

const DB_HOST=process.env.DB_HOST
const DB_NAME=process.env.DB_NAME
const DB_USER=process.env.DB_USER
const DB_PASS=process.env.DB_PASS
const MEDIA_DIR=process.env.MEDIA_DIR
let FB_ACCOUNT_ID='' // ID de Facebook de la cuenta a actualizar las publicaciones.
let CURRENT_DATE='' // Simulación de fecha actual en la que esta corriendo el script.
let CAMPAING_NAME='' // Nombre de la campaña que se desea actualizar.
let FORCE_ALL_CAMPAIGN_POSTS=false // True: buscar publicaciones desde el inicio de la campaña hasta el final - False: Buscar a partir del ultimo post guardado.
let IS_USERNAME_ID=false
let CUSTOM_RANGE_DATE=false
let CUSTOM_SINCE=''
let CUSTOM_UNTIL=''


const args = process.argv
if (args[2] === 'help' || args[2] === '--help' || args[2] === '-h') {
    const HELP = {
        'id *':'ID de Facebook de la cuenta (fbAccountId) [OBLIGATORIO PRIMERA POSICIÓN]  Ej: id="12312312312" |  id="nombreusuario',
        'date *': 'Fecha en la que se desea simular la ejecución del script [OBLIGATORIO SEGUNDA POSICIÓN]  Ej: date="2021-08-17T03:00:00.007Z"',
        'campaign *': 'Nombre de la campaña a la que pertenece la cuenta [OBLIGATORIO TERCERA POSICIÓN]  Ej: campaign="CAMPAÑA DE PRUEBA"',
        'force_all': 'Traer posts desde el principio de la campaña, sino se pasa el parámetro trae desde el último guardado en la DB  Ej: force_all=true',
        'is_username': 'Interpretar el parámetro "id" como nombre de usuario del link de la cuenta, sino, se interpreta como ID numérico (fbAccountId)  Ej: is_username=true',
        'custom_range': 'Usar un rango de fechas custom para ir a buscar posts a FB, sino se pasa el parámetro se usa las fechas de la campaña  Ej: custom_range=true',
        'custom_since': 'Fecha custom de inicio para ir a buscar posts en FB  Ej: custom_since="2021-08-17T03:00:00.007Z"',
        'custom_until': 'Fecha custom de fin para ir a buscar posts en FB  Ej: custom_until="2021-08-17T03:00:00.007Z"',
        'command example': 'single-monitor.js id="1000723776" date="2022-09-01T03:00:00.007Z" campaign="PASO ARG" force_all=true'
    }
    console.table(HELP)
    return 1;
}
if (args.length < 5){console.log('Faltan parametros, usar --help para la documentación.'); return 1}
// CONFIGURACIONES
for (let index = 0; index < args.length; index++) {
    const element = args[index];
    switch (index) {
        case 2:
            if(!element.includes('id=')) {console.log('Falta parametro id= ');return 1;}
            FB_ACCOUNT_ID = element.split('id=')[1];
            break;
        case 3:
            if(!element.includes('date=')) {console.log('Falta parametro date= ');return 1;}
            CURRENT_DATE=new Date(element.split('date=')[1]);
            break;
        case 4:
            if(!element.includes('campaign=')) {console.log('Falta parametro campaign= ');return 1;}
            CAMPAING_NAME = element.split('campaign=')[1];
            break;
        case 5:
            if(element.includes('force_all=')) {FORCE_ALL_CAMPAIGN_POSTS = eval(element.split('force_all=')[1])}
            if(element.includes('is_username=')) {IS_USERNAME_ID = eval(element.split('is_username=')[1])}
            if(element.includes('custom_range=')) {CUSTOM_RANGE_DATE = eval(element.split('custom_range=')[1])}
            if(element.includes('custom_since=')) {CUSTOM_SINCE = new Date(element.split('custom_since=')[1])}
            if(element.includes('custom_until=')) {CUSTOM_UNTIL = new Date(element.split('custom_until=')[1])}
            break;
        case 6:
            if(element.includes('force_all=')) {FORCE_ALL_CAMPAIGN_POSTS = eval(element.split('force_all=')[1])}
            if(element.includes('is_username=')) {IS_USERNAME_ID = eval(element.split('is_username=')[1])}
            if(element.includes('custom_range=')) {CUSTOM_RANGE_DATE = eval(element.split('custom_range=')[1])}
            if(element.includes('custom_since=')) {CUSTOM_SINCE = new Date(element.split('custom_since=')[1])}
            if(element.includes('custom_until=')) {CUSTOM_UNTIL = new Date(element.split('custom_until=')[1])}
            break;
        case 7:
            if(element.includes('force_all=')) {FORCE_ALL_CAMPAIGN_POSTS = eval(element.split('force_all=')[1])}
            if(element.includes('is_username=')) {IS_USERNAME_ID = eval(element.split('is_username=')[1])}
            if(element.includes('custom_range=')) {CUSTOM_RANGE_DATE = eval(element.split('custom_range=')[1])}
            if(element.includes('custom_since=')) {CUSTOM_SINCE = new Date(element.split('custom_since=')[1])}
            if(element.includes('custom_until=')) {CUSTOM_UNTIL = new Date(element.split('custom_until=')[1])}
            break;
        case 8:
            if(element.includes('force_all=')) {FORCE_ALL_CAMPAIGN_POSTS = eval(element.split('force_all=')[1])}
            if(element.includes('is_username=')) {IS_USERNAME_ID = eval(element.split('is_username=')[1])}
            if(element.includes('custom_range=')) {CUSTOM_RANGE_DATE = eval(element.split('custom_range=')[1])}
            if(element.includes('custom_since=')) {CUSTOM_SINCE = new Date(element.split('custom_since=')[1])}
            if(element.includes('custom_until=')) {CUSTOM_UNTIL = new Date(element.split('custom_until=')[1])}
            break;
        case 9:
            if(element.includes('force_all=')) {FORCE_ALL_CAMPAIGN_POSTS = eval(element.split('force_all=')[1])}
            if(element.includes('is_username=')) {IS_USERNAME_ID = eval(element.split('is_username=')[1])}
            if(element.includes('custom_range=')) {CUSTOM_RANGE_DATE = eval(element.split('custom_range=')[1])}
            if(element.includes('custom_since=')) {CUSTOM_SINCE = new Date(element.split('custom_since=')[1])}
            if(element.includes('custom_until=')) {CUSTOM_UNTIL = new Date(element.split('custom_until=')[1])}
            break;
        default:
            break;
    }
}
console.log(`
======================================
 Ejecutando con los siguientes valores:
    * Cuenta FB ID = ${FB_ACCOUNT_ID}
    * Día de ejecución = ${CURRENT_DATE}
    * Campaña = ${CAMPAING_NAME}
    * Usar rango de fechas custom = ${CUSTOM_RANGE_DATE}
    * Custom desde = ${CUSTOM_SINCE}
    * Custom hasta = ${CUSTOM_UNTIL}
    * Buscar publicaciones desde el principio de campaña = ${FORCE_ALL_CAMPAIGN_POSTS}
    * El FB ID es un nombre de usuario = ${IS_USERNAME_ID}
======================================
`)






const isApiLimitError = (error) =>  error.is_transient && 
                                    error.type === 'OAuthException' && 
                                    (error.code === 4 || error.code === 2 ) && 
                                    (error.message.includes('Application request limit reached') || error.message.includes('Please retry your request later'));


const analyzeError = async (err, account, campaign) => {
    const error = err.response.data.error;
    logger(`\nAnalizando Error de Cuenta: ${account.name}  Campaña: ${campaign.name} de ${campaign._doc.country}
    \n    * Error data: ${JSON.stringify(error)}`);

    if (isApiLimitError(error)) {
        // Error por llegar al limite en la API Graph.
        // Marcar cuenta como no procesada.
        account.processed = false;
        account.save();
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


const markAccountAsProcessed = (account, totalPost=0) => {
    account.lastDateProcessed = new Date();
    account.processed = true;
    account.lastTotalPostSaved = totalPost;
    account.save();

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
            fs.mkdir(MEDIA_DIR + newPath, { recursive: true }, (err) => {
                err ? console.log(err) :
                fs.rename(tmpURL, MEDIA_DIR + newPath + checksum + '.jpg', (err) => {
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
    // mongoose.connect(`mongodb://localhost:27017/publielectoral`, {useNewUrlParser: true});
    mongoose.connect(`mongodb://${DB_USER}:${DB_PASS}@${DB_HOST}/${DB_NAME}`, {useNewUrlParser: true});
};


const logger = (str) => console.log(str);


const getAccountById = async (accountId) => {
    let condition = {}
    if (IS_USERNAME_ID) {
        condition['link'] = {'$regex': `.*${accountId}.*`}
    } else {
        condition['fbAccountId'] = accountId
    }
    const response = await Account.find(condition);
    return response;
};


const existLastPostInDatabase = async (account) => {
    if (FORCE_ALL_CAMPAIGN_POSTS){ return null };
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


const getPostFromFacebook = async (facebookAPI, account, accountCampaign, lastPostDate) => {
    try {
        let sinceDate = accountCampaign.startDate;
        let untilDate = accountCampaign.endDate;
        if (CUSTOM_RANGE_DATE) {
            sinceDate = CUSTOM_SINCE;
            untilDate = CUSTOM_UNTIL;
        }
        const posts = await facebookAPI.getPosts(account, sinceDate, untilDate, lastPostDate, FB_ACCOUNT_ID);
        if (posts) {
            let postsSaved = 0;
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
            markAccountAsProcessed(account, postsSaved);
        }        
    } catch (err) {
        analyzeError(err, account, accountCampaign);
    }
};


const validCampaings = async (date, CampaignName) => {
    return await Campaign.find({
        'startDate': {'$lte': date},
        'endDate': {'$gte': date},
        'name': CampaignName
    });
};


const checkPosts = async (facebookAPI, _accountBuffer) => {
    databaseConnection();
    const currentDate = CURRENT_DATE;
    const campaigns = await validCampaings(currentDate, CAMPAING_NAME);
    logger(
        `----------------------------------------------------------------------------------------------------
        \nInicio script de publicaciones el ${currentDate.toLocaleString('es-AR')}
        \nSe encontraron ${campaigns.length} campañas activas:`
    );
    if (campaigns.length >= 1) {
        const campaingPromises = [];
        campaigns.forEach(
            async (campaign) => {
                campaingPromises.push(
                    new Promise(
                        async(resolve, _) => {
                            logger(
                                `\n   * Campaña: ${campaign.name} en ${campaign._doc.country}
                                \n        * Fecha de inicio: ${campaign.startDate.toLocaleString('es-AR')}
                                \n        * Fecha de fin: ${campaign.endDate.toLocaleString('es-AR')}`
                            );
                            // obtener la cuenta a monitorear.
                            const accounts = await getAccountById(FB_ACCOUNT_ID);

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
                                                        lastPostDate
                                                    )
                                                );
                                            }
                                        )
                                    );
                                }
                            );
                            await Promise.all(processedPromises);
                            resolve();
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

checkPosts(singleFbApi);

module.exports = {
    checkPosts,
    analyzeError,
    markAccountAsProcessed
}
