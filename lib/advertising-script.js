'use strict';
require('dotenv').load();

var mongoose                  = require('mongoose');
Promise                       = require('bluebird');
mongoose.Promise              = Promise;

const Account                 = require('../models/account');
const Post                    = require('../models/post');
const Advertising             = require('../models/advertising');
const Campaign                = require('../models/campaign');

let facebookPromise           = [];
let findPostPromise           = [];
let newAdvertisementsPromise  = [];
let linkedPromise             = [];

function openConnection() {
  mongoose.connect(`mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}/${process.env.DB_NAME}`, {useNewUrlParser: true});
  console.log('================================================== \n');
  console.log(`Starting ads script at ${new Date()}`);
}

function linkAdvertisingWithPost(advertising, post) {
  linkedPromise.push(
    Advertising.findOneAndUpdate(
      {'_id': advertising._id},
      {'$set': {postId: post._id, campaign: post.campaign}}
    )
      .then(() => {
        console.log(`Advertising ${advertising._id} and Post ${post._id} has been linked`);
      }).catch((error) => {
        console.log(`Failed to try update advertising ${advertising._id}`);
      })
  );
}

function makeNewPost(advertisingPost, advertising) {
  openConnection();
  Account.find({'fbAccountId': advertising.fbAccountId}, function(err, accountResponse) {
    if (err || accountResponse.length === 0) {
      console.log(`Didn\'t find Account with \'fbAccountId\': ${advertising.fbAccountId}\n Error: `, err);
      Advertising.findOneAndUpdate(
        {'_id': advertising._id},
        {'$set': {orphan: true}}
      )
        .then(() => {
          console.log(`Advertising has been marked as orphan`);
        }).catch((error) => {
          console.log(error)
          console.log(`Failed to try update advertising ${advertising._id}`);
        })
    } else {
      let postLink = `https://www.facebook.com/${advertisingPost.id}`
      let newPost = new Post({
        text: advertisingPost.message,
        publicDate: advertisingPost.created_time,
        image: advertisingPost.full_picture,
        postLink: postLink,
        fbPostId: advertisingPost.id,
        fbAccountId: advertising.fbAccountId,
        account: accountResponse[0]._id
      });
      newPost.save()
        .then(newPostSaved => {
          console.log(`Post ${newPostSaved._id} has been saved in Database successfully \n`);
          linkAdvertisingWithPost(advertising, newPostSaved);
        })
    }
  })
};

function getPostFromFacebook(advertising, facebookAPI) {
  facebookPromise.push(
    facebookAPI.getAdvertising(advertising.fbPostId, advertising.fbAccountId).then((advertisingResponse) => {
      makeNewPost(advertisingResponse[0], advertising)
    }).catch((error) => {
      console.log('Failed to try fetch advertising from Facebook \n', `${error}\n`);
    })
  );
  Promise.all(facebookPromise).then(() => {
    console.log('Fetch post from Facebook finished');
  });
}

function findPosts(advertisements, facebookAPI) {
  advertisements.forEach(advertising => {
    findPostPromise.push(
      Post.findOne({'fbPostId': advertising.fbAccountId + '_' + advertising.fbPostId}, function(error, postFoundInDataBase) {
        if (error) console.log('Failed to try fetch post from Database\n Error: ', error);
        postFoundInDataBase === null ? getPostFromFacebook(advertising, facebookAPI) : linkAdvertisingWithPost(advertising, postFoundInDataBase);
      })
    );
  });

  Promise.all(findPostPromise).then(() => {
    console.log('Find Posts Promise finished');
  });
}

function updateAdsCampaign(ads, campaign) {
  const campaignCountry = campaign._doc.country;
  ads.filter(ad => campaignCountry === ad.userSelectedLocation);
  const ad_ids = ads.map(ad => ad._id) || [];
  Advertising.updateMany(
    { '_id':{ '$in' : ad_ids } },
    { '$set': { "campaign": campaign._id } },
    function (err,val) {
      if (err) {
        console.log('ERROR AL ACTUALIZAR CAMPAÑAS DE ADS: ', err);
      }
      else {
        console.log('CAMPAÑAS DE ADS ACTUALIZADAS: ', val);
        console.log('Searching posts for ads... \n');
        findPosts(ads, facebookAPI);
      }
    }
  );
}


function updateAdsOfCurrentCampaing(ads, facebookAPI) {
  let currentDate = new Date();
  Campaign.find({
    'startDate': {'$lte': currentDate},
    'endDate': {'$gte': currentDate}
  }, function(err, campaigns) {    
    if (campaigns.length >= 1) {
      campaigns.forEach(campaign => {
        updateAdsCampaign(ads, campaign, facebookAPI);
      });
    }
  });
}


function searchAdvertisements(facebookAPI) {  
  let newAdvertisements = [];
  openConnection();
  newAdvertisementsPromise.push(
    Advertising.find({'postId': null, 'orphan': null}, function(error, advertisementsResponse) {
      if (error) console.log('Failed trying to fetch advertisements from Database\n Error: ', error);
      newAdvertisements = advertisementsResponse;
      advertisementsResponse.length === 0 ? console.log('Haven\'t new advertisements in Database \n') : console.log(`${advertisementsResponse.length} advertisements has been found in Database \n`);
    })
  );
  Promise.all(newAdvertisementsPromise).then(() => {
    if (newAdvertisements.length !== 0) {
      // console.log('Updating campaing for ads...');      
      // updateAdsOfCurrentCampaing(newAdvertisements, facebookAPI);
      findPosts(newAdvertisements, facebookAPI)
    }
  });
}

module.exports = {
  searchAdvertisements
};
