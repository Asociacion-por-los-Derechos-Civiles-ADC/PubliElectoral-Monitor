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

const databaseConnection = () => mongoose.connect(`mongodb://localhost:27017/publielectoral`, {useNewUrlParser: true})

const getCampaign = async (campaignName) => await Campaign.findOne({ 'name': campaignName });

const getPosts = async (campaign) => {
    return await Post.aggregate(
        [
          {
            $match: {
              '$and': [
                  { 'campaign': { '$in': [ campaign._id ] } },
                  {"group": { "$exists": true }},
                  {"group.total":{ "$gte":2 }}
              ]
            }
          },
          { 
              "$group": { 
                  _id: "$group.num",
                  "posts": { $addToSet: '$_id' },
                  "total": { $addToSet: "$group.total"}
               }
          }
        ]
      );
};


const processGroup = async (group) => {
    console.log('grupo ', group)
    let posts = group.posts
    const fst = posts.shift()
    console.log('posts ids: ', posts)
    const condition = {
        "_id": { "$in": posts }
    }
    const update = {
        "$set": { "esCopia": true }
    }
    const options = {
        "many": true
    }
    const updated = await Post.updateMany(condition, update, options)
    logger(`   * Se actualizaron ${JSON.stringify(updated)}`)
    return updated
};


const tagPosts = async () => {
    databaseConnection();
    const postsProcessed = [];
    const campaign = await getCampaign("Eleição presidencial");
    logger(`  * Campaña: ${campaign.name}`)
    let groupedPosts = await getPosts(campaign);
    logger(` * Total publicaciones: ${groupedPosts.length}`);

    for (let index = 0; index < groupedPosts.length; index++) {
        const group = groupedPosts[index];
        postsProcessed.push(
            // new Promise(
            //     async (resolve,_) => {
                    await processGroup(group)
            //         resolve()
            // })
        )
    }

    await Promise.all(postsProcessed);
    logger('  * Se procesaron todos los posts.');
};

tagPosts().then(() => process.exit(1));

module.exports = {
    tagPosts
};