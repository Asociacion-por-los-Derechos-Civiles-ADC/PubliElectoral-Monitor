'use strict';

const axios           = require('axios');
const hmacSHA256      = require('crypto-js/hmac-sha256');
const hex             = require('crypto-js/enc-hex');
const Error           = require('../models/errors');
const access_token    = process.env.FB_TOKEN;
const appsecret_proof = hmacSHA256(access_token, process.env.FB_CLIENT_SECRET).toString(hex);
const post_fields     = 'id,message,created_time,full_picture'


const belongToCampaing = (campaignDate, date) => date.getTime() >= campaignDate.getTime();
const logger = (str) => console.log(str);


const saveError = async (err, account, page_id) => {
  const error = err.error? err.error : err;
  console.log(error)
  const newError = new Error({
    account: account,
    fbAccountId: page_id,
    message: error.message,
    type: error.type,
    error_subcode: error.error_subcode,
    code: error.code,
    date: new Date()
  })
  await newError.save()
  logger('Error guardado.')
}


const getFeedByID = async (page_id, since, until) => {
  const url = `${process.env.FB_API_URL}${page_id}/feed?limit=1&`+
  `access_token=${access_token}&`+
  `since=${since.toUTCString()}&until=${until.toUTCString()}`
  logger(`Requesting: ${url}`)
  return await axios.get(url)
    .then((response) => {
      return response.data.data
    })
}


const getPostDetails = async (posts, account) => {
  logger(`Se encontraron ${posts.length} publicaciones para la cuenta ${account.name}.`)
  const result = []
  const postPromise = []
  
  for (let index = 0; index < posts.length; index++) {
    const post = posts[index];
    logger(`Obteniendo detalles de la publicación ${post.id} de ${account.name}`)
    const url = `${process.env.FB_API_URL}${post.id}?`+
                `access_token=${access_token}&`+
                `appsecret_proof=${appsecret_proof}&`+
                `fields=${post_fields}`
    try {
      postPromise.push(
        axios.get(url)
          .then((response) => result.push(response))
          .catch((err) => saveError(err.response.data, account.name, account.fbAccountId))
      )
      return Promise.all(postPromise)
        .then(() => result)
    } catch (error) {
      logger(`Error postPromise ${error}`)
    }
  }
}



const getPosts = async (account, startDateCampaign, endDateCampaign, lastPostDate) => {
  const page_id = account.fbAccountId
  const page_text_id = (new URL(account.link)).pathname.replace('/','')
  const startDate = (
    lastPostDate && belongToCampaing(startDateCampaign, lastPostDate) ? lastPostDate : startDateCampaign
  )
  const endDate = new Date(endDateCampaign)
  endDate.setDate(endDate.getDate())
  const since = startDate
  const until = endDate
  let posts = []
  
  logger(`\nBuscar publicaciones en FB 
    entre el ${since.toUTCString()} y el ${until.toUTCString()} 
    para la cuenta ${account.name}.`)

    try {
      const feedResponse = await getFeedByID(page_id, since, until)
      posts = await getPostDetails(feedResponse, account)
      return posts
    } catch (err) {
      const { error: { type, code } } = err.response.data
      if (type === 'GraphMethodException' && code === 100) {
        try {
          logger(`try con page_text ${page_text_id}`)
          const feedResponse = await getFeedByID(page_text_id, since, until)
          posts = await getPostDetails(feedResponse, account)
          return posts
        } catch (err) {
          const error = err.response ? err.response.data : err
          logger(`Error buscar detalles de post por ID nombre: ${error}`)
          saveError(error, account.name, account.fbAccountId)
        }
      } else {
        await saveError(err.response.data, account.name, account.fbAccountId)
      }
    }
}


function getPost(account, startDateCampaign, endDateCampaign, lastPostDate) {
  return new Promise((resolve, reject) => {
    // const page_id = account.fbAccountId;
    const page_id = (new URL(account.link)).pathname.replace('/', '');
    const startDate = (lastPostDate && belongToCampaing(startDateCampaign, lastPostDate) ? lastPostDate : startDateCampaign);
    const since = startDate;
    const endDate = new Date(endDateCampaign);
    endDate.setDate(endDate.getDate());
    const until = endDate;

    console.log(`\nBuscar publicaciones entre el ${since.toUTCString()} y el ${until.toUTCString()} para la cuenta ${account.name}.`);

    axios.get(`${process.env.FB_API_URL}${page_id}/feed?access_token=${access_token}&`
                        + `appsecret_proof=${appsecret_proof}&since=${since.toUTCString()}&until=${until.toUTCString()}`)
      .then(function (response) {
        // handle success
        const postsPromises = [];
        const result = [];
        const posts = response.data.data;
        console.log(`Se encontraron ${posts.length} publicaciones para la cuenta ${account.name}.`);
        posts.forEach( post => {
          const url = `${process.env.FB_API_URL}${post.id}?access_token=${access_token}&`
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
        console.log('Error cuando se querían traer detalles de publicaciones desde Facebook:\n');
        console.log(`status: ${error.response.status} ${error.response.statusText}`)
        console.log('url: ', error.response.config.url)
        console.log(error.response.data)
        reject(error);
      });
  });
}

function getAdvertising(fbPostId, fbAccountId) {
  return new Promise((resolve, reject) => {
    const postsPromises = [];
    const result = [];
    const url = `${process.env.FB_API_URL}${fbAccountId}_${fbPostId}?access_token=${access_token}&` +
    `appsecret_proof=${appsecret_proof}&fields=id,message,created_time,full_picture`;
    postsPromises.push(axios.get(url)
      .then(function (response) {
        result.push(response.data);
        Promise.all(postsPromises).then((p) => {
          resolve(result);
        });
      })
      .catch(function (error) {
        console.log('Error cuando se querían traer detalles de publicaciones desde Facebook:\n');
        console.log(`status: ${error.response.status} ${error.response.statusText}`)
        console.log('url: ', error.response.config.url)
        console.log(error.response.data)
        reject(error);
      })
    );
  });
};

module.exports = {
  getPosts,
  getAdvertising
};
