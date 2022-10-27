'use strict';
require('dotenv').load();

const mongoose    = require('mongoose');
// Promise           = require('bluebird');
mongoose.Promise  = Promise;

const Account     = require('../models/account');
const Campaign    = require('../models/campaign');
const Post        = require('../models/post');

const DB_HOST=process.env.DB_HOST
const DB_NAME=process.env.DB_NAME
const DB_USER=process.env.DB_USER
const DB_PASS=process.env.DB_PASS
let PROCESADAS = []

const exampleText = "🚨 BOLSOCARO QUER CONGELAR O SALÁRIO MÍNIMO! 🚨 \n\nJá imaginou? Mais um risco que corremos se Bolsocaro seguir na presidência: *ele e Guedes querem congelar o salário mínimo*, independente dos valores da inflação.\n\n*Essa é mais uma tática para manter o povo na miséria.* Quem não cuida da gente não deve ser presidente.\n\nDia 30 é #LuLaPresidenteUrgente !"

// const exampleText = "Olha aí o Helder com o senador que mais cresce nas pesquisas!\n\nObrigado pelo carinho, Abaetetuba! \n\nEu tô com Helder e não é de hoje!"

const logger = (str) => console.log(str);

// const databaseConnection = () => mongoose.connect(`mongodb://${ DB_USER }:${ DB_PASS }@${ DB_HOST }/${ DB_NAME }`, { useNewUrlParser: true });
const databaseConnection = () => mongoose.connect(`mongodb://localhost:27017/publielectoral`, {useNewUrlParser: true})

const getCampaign = async (campaignName) => await Campaign.findOne({ 'name': campaignName });

const getPosts = async (campaign) => {
    return await Post.find({
        '$and': [
            { 'campaign': { '$in': [ campaign.id ] } },
            { 'text': { '$exists': true } }
        ]
    }).limit(100);
};

const condition = (post, postToCompare) => (
    !post.group['num']>0) && (
            post._id !== postToCompare._id 
                && post.text === postToCompare.text
        );

const esperar = (time) => new Promise(resolve => setTimeout(resolve, time))

const procesarPost = async (postToCompare, idx, all, groupIdx) => {
    
    logger(`  * ${idx+1} - Procesando post: ${postToCompare.fbPostId} ...`);
    const groupPosts = new Promise(
        async(resolve,_)=> {
            let groupPosts = all.filter((p) => condition(p, postToCompare)).concat(postToCompare);
            groupPosts = groupPosts.filter(g => g !== undefined);
            logger(`  * ${idx+1} - Repetidos para ${postToCompare.fbPostId}: ${groupPosts.length-1}`)
            const gp_ids = groupPosts.map(gp => gp._id);

            for (let index = 0; index < gp_ids.length; index++) {
                const element = groupPosts[index];
                PROCESADAS.push(element)
            }
            if (gp_ids.length > 0) {
                const updated = await Post.updateMany(
                    { '_id': { '$in': gp_ids } },
                    { '$set': { 'group': { 'num': groupIdx, 'total': gp_ids.length } } },
                    { 'many': true }
                )
                logger(`  * ${idx+1} - Actualizados: ${updated['nModified']}`);
                logger(`  * ${idx+1} - Post ${postToCompare.fbPostId} procesado.\n`)
            } else {
                logger(`  * ${idx+1} - Post ${postToCompare.fbPostId} sin repetidos\n`)
            }
            return resolve()
        }
    )
    return await groupPosts;
}

const groupDoubles = async () => {
    databaseConnection();
    const postsProcessed = [];
    const campaign = await getCampaign("Eleição presidencial");
    logger(`  * Campaña: ${campaign.name}`)
    let posts = await getPosts(campaign);
    logger(` * Total publicaciones: ${posts.length}`);
    let groupIdx = 1;
    await esperar(1000)
    let idx = 0;
    let all = posts
    
    while ( posts.length > 0 ) {
        posts = posts.filter(p => !PROCESADAS.includes(p._id))
        let post = posts.shift();
        postsProcessed.push(procesarPost(post, idx, all, groupIdx))
        idx = idx+1
        groupIdx = groupIdx +1
    }
    
    // posts.forEach(async(post, idx, all) => {
    //     // await esperar(2000);
    //     logger(`  * Numero de grupo: ${groupIdx}`)
    //     postsProcessed.push(
    //         procesarPost(post, idx, all, groupIdx)
    //     )
    //     groupIdx = groupIdx +1;
    // });
    await Promise.all(postsProcessed);
    logger('  * Se procesaron todos los posts.');
};

groupDoubles().then(() => process.exit(1));

module.exports = {
    groupDoubles
};