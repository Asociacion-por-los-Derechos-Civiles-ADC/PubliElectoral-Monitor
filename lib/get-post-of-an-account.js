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

const DB_HOST=process.env.DB_HOST
const DB_NAME=process.env.DB_NAME
const DB_USER=process.env.DB_USER
const DB_PASS=process.env.DB_PASS
const MEDIA_DIR='./media.publielectoral.lat'

// CONFIGURACIONES
const FB_ACCOUNT_ID='' // ID de Facebook de la cuenta a actualizar las publicaciones.
const CURRENT_DATE=new Date('2021-08-17T03:00:00.007Z'); // Simulación de fecha actual en la que esta corriendo el script.
const CAMPAING_NAME='' // Nombre de la campaña que se desea actualizar.
const FORCE_ALL_CAMPAIGN_POSTS=true // True: buscar publicaciones desde el inicio de la campaña hasta el final - False: Buscar a partir del ultimo post guardado.

function getPostOfOneAccount(facebookAPI) {

  mongoose.connect(`mongodb://${DB_USER}:${DB_PASS}@${DB_HOST}/${DB_NAME}`, {useNewUrlParser: true});

  let currentDate         = CURRENT_DATE;

  // Verify if the script is running in a campaign period.
  Campaign.find({
    'startDate': {'$lte': currentDate},
    'endDate': {'$gte': currentDate},
    'name': CAMPAING_NAME
  }, function(err, campaigns) {
    console.log('----------------------------------------------');
    console.log(`\nStarting script at ${currentDate.toUTCString()}`);
    console.log(`\nSe encontraron ${campaigns.length} campañas activas.`);
    if (campaigns.length >= 1) {
      campaigns.forEach(campaign => {
        console.log('----------------------------------------------');
        console.log(`\nCampaña activa: ${campaign.name}`);
        console.log(`Fecha Inicio: ${campaign.startDate.toUTCString()}`);
        console.log(`Fecha Fin: ${campaign.endDate.toUTCString()}`);
        // Get all accounts for to monitoring.
        Account.find({'fbAccountId': FB_ACCOUNT_ID }, function(err, accounts) {
          if(accounts.length === 0) {
            console.log(`No accounts configured for campaign: ${campaign.name}. Skipped.`)
          }
          // Get all posts for each account
          accounts.forEach(async account => {
            console.log('----------------------------------------------');
            const accountCampaign = await getCurrentCampaignOfAnAccount(account, currentDate);
            console.log(`Fetching cuenta: ${account.name} | campaña: ${accountCampaign.name}`);
            Post.findOne({'fbAccountId': FB_ACCOUNT_ID}).sort('-publicDate').then(post => {
              let lastPostDate = FORCE_ALL_CAMPAIGN_POSTS ? null : post ? post.publicDate : null
              console.log(`Fecha de ultimo post guardado: ${account.name} `, lastPostDate)
              facebookAPI.getPost(account, accountCampaign.startDate, accountCampaign.endDate, lastPostDate)
                .then(posts => {
                  posts.map(post => {
                    if (post.full_picture) {
                      const tmpURL = 'img/tmp/' + post.id;
                      downloadImage(post.full_picture, tmpURL).then(() => moveImage(tmpURL, post, accountCampaign));
                    }
                    let postLink = `https://www.facebook.com/${post.id}`
                    // Add account field to post.
                    return new Post({
                      text: post.message,
                      publicDate: post.created_time,
                      image: post.full_picture,
                      postLink: postLink,
                      fbPostId: post.id,
                      account: account._id,
                      fbAccountId: account.fbAccountId,
                      campaign: accountCampaign._id,
                      politicalParty: account.politicalParty,
                    });
                    })
                    // Save each post in database.
                    .forEach(post => {
                      post.save().then((savedPost) => {
                        console.log(`Post ${savedPost._id} has been saved successfully!`);
                      }).catch(error => {
                        console.log('Failed to try save post: ', error);
                      })
                    });
                }).catch(error => {
                  console.log('Failed to try fetch posts: ', error);
                })
            })
          });
        })
      });
    } else {
      console.log('\nNot found active campaign\n');
    }
  });
};

function updateImageChecksum(post, path) {
  Post.find({'fbPostId': post.id}).then(posts => {
    posts.map((savedPost) => {
      savedPost.localImgUrl = path;
      const msg = 'Image: ' + path + ' from post: ' + post.id + ' saved succesfuly!';
      savedPost.save().then(() => console.log(msg));
    });
  })
}

function moveImage(tmpURL, post, campaign) {
  fs.readFile(tmpURL, function(err, data) {
    if (err) { console.log(err) }
    else {
      const checksum = generateChecksum(data);
      post.image_checksum = checksum;
      const newPath = '/img/campaigns/' + campaign._id + '/uncategorized/';
      fs.mkdir(MEDIA_DIR + newPath, { recursive: true }, (err) => {
        err ? console.log(err) :
        fs.rename(tmpURL, MEDIA_DIR + newPath + checksum + '.jpg', (err) => {
          err ? console.log(err) :
          updateImageChecksum(post, newPath + checksum + '.jpg')
        });
      });
    }
  });
}

function generateChecksum(str) {
  return crypto
    .createHash('md5')
    .update(str, 'utf8')
    .digest('hex');
}

function downloadImage(url, image_path) {
  return axios({
    url,
    responseType: 'stream',
  }).then(
    response =>
      new Promise((resolve, reject) => {
        response.data
          .pipe(fs.createWriteStream(image_path))
          .on('finish', () => resolve())
          .on('error', e => reject(e));
      }),
  );
}

async function getCurrentCampaignOfAnAccount(account, currentDate) {
  const accountCampaigns = account.campaigns;
  return Campaign.findOne({
    $and: [
      {
        'startDate': {'$lte': currentDate},
        'endDate': {'$gte': currentDate},
      },
      {
        '_id': { $in: accountCampaigns }
      },
      { 'name': CAMPAING_NAME }
    ]
  }).then(campaing => campaing);
}

getPostOfOneAccount(require('./facebook-api-single'))
module.exports = {
    getPostOfOneAccount
};
