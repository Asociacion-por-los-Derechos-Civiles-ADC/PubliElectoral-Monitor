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

var accountPacks = [];


async function getCurrentCampaignOfAnAccount(account, currentDate) {
  const accountCampaigns = account.campaigns;
  return Campaign.findOne({
    $and: [
      {
        'startDate': {'$lte': currentDate},
        'endDate': {'$gte': currentDate}
      },
      {
        '_id': { $in: accountCampaigns }
      }
    ]
  }).then(campaing => campaing);
}


function checkPosts(facebookAPI, accountBuffer) {
  
  mongoose.connect(`mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}/${process.env.DB_NAME}`, {useNewUrlParser: true});
  

  let currentDate         = new Date();

  // Verify if the script is running in a campaign period.
  Campaign.find({
    'startDate': {'$lte': currentDate},
    'endDate': {'$gte': currentDate}
  }, function(err, campaigns) {
    console.log('----------------------------------------------');
    console.log(`\nInicio script de publicaciones el ${currentDate.toLocaleString()}`);
    console.log(`\nSe encontraron ${campaigns.length} campañas activas`);
    if (campaigns.length >= 1) {
      campaigns.forEach(campaign => {
        console.log('----------------------------------------------');
        console.log(`\nCampaña: ${campaign.name}`);
        console.log(`Fecha de inicio: ${campaign.startDate.toUTCString()}`);
        console.log(`Fecha de fin: ${campaign.endDate.toUTCString()}`);
        // Get all accounts for to monitoring.
        Account.find({'campaigns': campaign._id }, function(err, accounts) {
          console.log('CANTIDAD TOTAL DE CUENTAS: ', accounts.length);
          if(accounts.length === 0) {
            console.log(`No hay cuentas con la campaña: ${campaign.name} configurada. Skipped`)
          }
          new Promise((resolve, reject) => {
            let packAccounts = [];
            try {
              if(fs.existsSync('./accountBuffer.txt')) {
                  packAccounts = fs.createReadStream('accountBuffer.txt');
              } else {
                  console.log('NO EXISTE EL ARCHIVO BUFFER DE CUENTAS');
              }
            } catch (err) {
                console.error('ERROR AL QUERER BUSCAR EL ARCHIVO BUFFER DE CUENTAS: ', err);
            }           
            
            console.log('Tamaño de pack de cuentas: ', accountPacks.length)
            if (accountPacks.length !== 0) {
              packAccounts = accountPacks[0];
            } else {
              accountPacks = generatePackAccounts(accounts, 4); // Cambiar el número (50) por la cantidad de cuentas que se desea tener por paquete
              console.log('Paquetes generados ', accountPacks.length)
              packAccounts = accountPacks.length !== 0? accountPacks[0] : [];
            }
            accountPacks.splice(0, 1);
            savePack(accountPacks);
            resolve(packAccounts);
          })
          .then(accounts => {
            // Get all posts for each account
            accounts.forEach(async (account) => {
              console.log('----------------------------------------------');
              const accountCampaign = await getCurrentCampaignOfAnAccount(account, currentDate);
              console.log(`Fetching cuenta: ${account.name} | campaña: ${accountCampaign.name}`);
              Post.findOne({'fbAccountId': account.fbAccountId}).sort('-publicDate').then(post => {
                let lastPostDate = post ? post.publicDate : null;
                console.log(`Último post encontrado en la base de datos: ${account.name} `, lastPostDate)
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
                          console.log(`Post ${savedPost._id} se guardó satisfactoriamente!`);
                        }).catch(error => {
                          console.log('Falló al intentar guardar el post en la base de datos: ', error);
                        })
                      });
                  }).catch(error => {
                    console.log('Falló al traer post desde Facebook: ', error.response.data);
                  })
              })
            });
          })
        })
      });
    } else {
      console.log('\nNo se encontraron campañas activas\n');
    }
  });
  return accountBuffer;
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
      fs.mkdir(process.env.MEDIA_DIR + newPath, { recursive: true }, (err) => {
        err ? console.log(err) :
        fs.rename(tmpURL, process.env.MEDIA_DIR + newPath + checksum + '.jpg', (err) => {
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

function savePack(data) {  
  var file = fs.createWriteStream('./accountBuffer.txt');
  file.on('error', function(err) { console.log('ERROR AL GUARDAR BUFFER: ', err) });
  data.forEach(function(v) { file.write(v.join(', ') + '\n'); });
  file.end();
}


function generatePackAccounts(accounts, count) {
  let temp = [];
  let lscopy = new Array(...accounts);
  
  return accounts.reduce((acc,account,idx,_) => {
      if(temp.length < count) {
         temp.push(account);
         lscopy.shift(idx);
         return acc;
      }
      lscopy.shift(idx);
      acc.push(temp);
      temp = [account];

      if (accounts.length%2 === 1) {
          if (lscopy.length === 0 && temp.length >= 1) {
              acc.push(temp);
          }
          if (lscopy.length === 2 && temp.length === 1) {
              acc.push(temp.concat(lscopy));
          }
      } else {
          if (lscopy.length <= 2 && temp.length === 1) {
              acc.push(temp.concat(lscopy));
          }
      }
      return acc;
  }, []);
}

module.exports = {
  checkPosts
};
