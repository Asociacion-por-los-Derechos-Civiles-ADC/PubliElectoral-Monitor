'use strict';
require('dotenv').load();

const mongoose    = require('mongoose');
Promise           = require('bluebird');
mongoose.Promise  = Promise;

const Campaign    = require('../models/campaign');
const Post        = require('../models/post');

const DB_HOST=process.env.DB_HOST
const DB_NAME=process.env.DB_NAME
const DB_USER=process.env.DB_USER
const DB_PASS=process.env.DB_PASS
const MEDIA_DIR=process.env.MEDIA_DIR


const logger = (str) => console.log(str);

//const databaseConnection = () => mongoose.connect(`mongodb://localhost:27017/publielectoral`, {useNewUrlParser: true})
//const databaseConnection = () => mongoose.connect(`mongodb://root:123456@localhost:7017/publielectoral?authSource=admin&w=1`, {useNewUrlParser: true});
const databaseConnection = () =>mongoose.connect(`mongodb://${DB_USER}:${DB_PASS}@${DB_HOST}/${DB_NAME}`, {useNewUrlParser: true});

const getCampaign = async (campaignName) => await Campaign.findOne({ 'name': campaignName });

const getRepeatPostsWithoutEsCopia = async (campaign) => {
    return await Post.find(
        {
        '$and': [
            { 'campaign': { '$in': [ campaign._id ] } },
            {"group": { "$exists": true }},
            {"group.total":{ "$gte":2 }},
            {"esCopia":{ "$exists": false }}    
        ]
       }
      );
};


const processPost = async (post) => {
    
    console.log('Grupo a actualizar: ', post.group.num)
    console.log('Tipo: ', post['type'])
    
    const condition = {
        '$and': [
         {'campaign': { '$in': [ post.campaign ] } },
         {"group.num": { "$in": post.group.num }}
        ]        
    }
    const update = {
        "$set": { "type": post.type }
    }
    const options = {
        "many": true
    }
    

    const updated = await Post.updateMany(condition, update, options)
    logger('   * Se deberian haber actualizado: ', post.group.total)
    logger(`   * Se actualizaron ${JSON.stringify(updated)}`)
    return updated
};


const assignTypeToRepeat = async () => {
    databaseConnection();
    const postsProcessed = [];
    const campaign = await getCampaign("Eleição presidencial");
    logger(`  * Campaña: ${campaign.name}`)
    let groupedPosts = await getRepeatPostsWithoutEsCopia(campaign);
    logger(` * Total publicaciones sin repetir: ${groupedPosts.length}`);

    for (let index = 0; index < groupedPosts.length; index++) {
        const post = groupedPosts[index];
        postsProcessed.push(
            // new Promise(
            //     async (resolve,_) => {
                    await processPost(post)
            //         resolve()
            // })
        )
    }

    await Promise.all(postsProcessed);
    logger('  * Se procesaron todos los posts.');
};

assignTypeToRepeat().then(() => process.exit(1));

module.exports = {
    assignTypeToRepeat
};