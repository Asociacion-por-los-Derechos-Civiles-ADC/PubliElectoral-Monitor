'use strict';
// CONFIGURACIONES
const FB_CLIENT_SECRET=process.env.FB_CLIENT_SECRET
const FB_TOKEN=process.env.FB_TOKEN
const FB_API_URL=process.env.FB_API_URL

const axios           = require('axios');
const hmacSHA256      = require('crypto-js/hmac-sha256');
const hex             = require('crypto-js/enc-hex');
const access_token    = FB_TOKEN;
const appsecret_proof = hmacSHA256(access_token, FB_CLIENT_SECRET).toString(hex);

function getPost(account, startDateCampaign, endDateCampaign, lastPostDate) {
  return new Promise((resolve, reject) => {
    const page_id = (new URL(account.link)).pathname;
    const startDate = (lastPostDate ? lastPostDate : startDateCampaign);
    const since = startDate.toUTCString();
    const endDate = new Date(endDateCampaign);
    endDate.setDate(endDate.getDate() + 1);
    const until = endDate.toUTCString();

    console.log(`\nBuscar en FB  ${account.name} Posts Entre: ${since} y ${until}`);

    axios.get(`${FB_API_URL}${account.fbAccountId}/feed?access_token=${access_token}&`
                        + `appsecret_proof=${appsecret_proof}&since=${since}&until=${until}&limit=100`)
      .then(function (response) {
        // handle success
        const postsPromises = [];
        const result = [];
        const posts = response.data.data
        // console.log(response)
        console.log(`${posts.length} posts found for ${account.name} account!`);
        posts.forEach( post => {
          const url = `${FB_API_URL}${post.id}?access_token=${access_token}&`
          + `appsecret_proof=${appsecret_proof}&fields=id,message,created_time,full_picture`;
          postsPromises.push(axios.get(url)
            .then(function (response) {
              // handle success
              result.push(response.data);
            })
            .catch(function (error) {
              // handle error
              reject(error);
            })
          );
        });
        Promise.all(postsPromises).then((p) => {
          resolve(result);
        });
      })
      .catch(function (error) {
        // handle error
        console.log('Error while trying to fetch data from Facebook API Posts Details');
        reject(error);
      });
  });
}

function getAdvertising(fbPostId, fbAccountId) {
  return new Promise((resolve, reject) => {
    const postsPromises = [];
    const result = [];
    const url = `${FB_API_URL}${fbAccountId}_${fbPostId}?access_token=${access_token}&` +
    `appsecret_proof=${appsecret_proof}&fields=id,message,created_time,full_picture`;
    postsPromises.push(axios.get(url)
      .then(function (response) {
        result.push(response.data);
        Promise.all(postsPromises).then((p) => {
          resolve(result);
        });
      })
      .catch(function (error) {
        reject(error);
      })
    );
  });
};

module.exports = {
  getPost,
  getAdvertising
};
