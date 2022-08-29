'use strict';

const axios           = require('axios');
const hmacSHA256      = require('crypto-js/hmac-sha256');
const hex             = require('crypto-js/enc-hex');
const access_token    = process.env.FB_TOKEN;
const appsecret_proof = hmacSHA256(access_token, process.env.FB_CLIENT_SECRET).toString(hex);
const post_fields     = 'id,message,created_time,full_picture';


const belongToCampaing = (campaignDate, date) => date.getTime() >= campaignDate.getTime();


const logger = (str) => console.log(str);


const getFeedByID = async (page_id, since, until) => {
  const url = `${process.env.FB_API_URL}${page_id}/feed?limit=25&`+
  `access_token=${access_token}&`+
  `since=${since.toUTCString()}&until=${until.toUTCString()}`
  logger(`      * Requesting: ${url}`);
  return await axios.get(url)
    .then((response) => {
      return response.data.data
    })
};


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
      return Promise.all(postPromise)
        .then(() => result)
    } catch (error) {
      throw error;
    }
  }
};



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
  
  logger(`\n   * Buscar publicaciones en FB 
          * entre el ${since.toUTCString()} y el ${until.toUTCString()} 
          * para la cuenta ${account.name}.`)

    try {
      const feedResponse = await getFeedByID(page_id, since, until)
      posts = await getPostDetails(feedResponse, account)
      return posts
    } catch (err) {
      const { error: { type, code } } = err.response.data;
      
      // Ver si falla por ID numérico y reintentar la llamada con el username.
      if (type === 'GraphMethodException' && code === 100) {
        try {
          logger(`\n   * Intento con ID: ${page_text_id}`)
          const feedResponse = await getFeedByID(page_text_id, since, until)
          posts = await getPostDetails(feedResponse, account)
          return posts
        } catch (err) {
            throw err;
        }
      } else {
          throw err;
      }
    }
}

module.exports = {
  getPosts,
};
