'use strict';
const FB_CLIENT_SECRET=process.env.FB_CLIENT_SECRET
const FB_TOKEN=process.env.FB_TOKEN
const FB_API_URL=process.env.FB_API_URL

const axios           = require('axios');
const hmacSHA256      = require('crypto-js/hmac-sha256');
const hex             = require('crypto-js/enc-hex');
const access_token    = FB_TOKEN;
const appsecret_proof = hmacSHA256(access_token, FB_CLIENT_SECRET).toString(hex);
const post_fields     = 'id,message,created_time,full_picture';

const logger = (str) => console.log(str);

const getFeedByID = async (page_id, since, until) => {
    const url = `${FB_API_URL}${page_id}/feed?`+
                `limit=100`+
                `&access_token=${access_token}`+
                `&since=${since.toUTCString()}&until=${until.toUTCString()}`
    logger(`      * Requesting: ${url}`);
    return await axios.get(url)
        .then((response) => {
            return response.data.data
        })
}


const getPostDetails = async (posts, account) => {
    logger(`   * Se encontraron ${posts.length} publicaciones en la cuenta ${account.name}`)
    const result = []
    const postPromise = []

    for (let index = 0; index < posts.length; index++) {
        const post = posts[index];
        logger(`   * Obteniendo detalles de la publicación ${post.id} de ${account.name}`)
        const url = `${process.env.FB_API_URL}${post.id}?`+
                    `access_token=${access_token}&`+
                    `appsecret_proof=${appsecret_proof}&`+
                    `fields=${post_fields}`
        try {
          postPromise.push(
            axios.get(url)
              .then((response) => result.push(response))
              .catch((err) => {throw err})
          );
        } catch (error) {
          throw error;
        }
      }
    return Promise.all(postPromise)
        .then(() => result)
}


const getPosts = async (account, startDateCampaign, endDateCampaign, lastPostDate, fbAccountId) => {
    const page_id = fbAccountId
    const startDate = lastPostDate  ? lastPostDate : startDateCampaign;
    const endDate = new Date(endDateCampaign)
    endDate.setDate(endDate.getDate())
    const since = startDate
    const until = endDate
    let posts = []
    
    logger(`\n   * Buscar publicaciones en FB 
            * entre el ${since.toUTCString()} y el ${until.toUTCString()} 
            * para la cuenta ${account.name}.`)
  
      try {
        const feedResponse = await getFeedByID(page_id, since, until)
        posts = await getPostDetails(feedResponse, account)
        return posts
      } catch (err) {
        throw err;
      }
  }

  module.exports = {
    getPosts,
  };