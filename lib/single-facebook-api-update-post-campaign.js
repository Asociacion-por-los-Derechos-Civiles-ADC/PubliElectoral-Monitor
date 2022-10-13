'use strict';
const Post = require('../models/post');
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

const getFeedByID = async (page_id, since, until, account) => {
    const url = `${FB_API_URL}${page_id}/feed?`+
                `limit=100`+
                `&access_token=${access_token}`+
                `&since=${since.toUTCString()}&until=${until.toUTCString()}`
    logger(`      * Requesting: ${url}`);
    return await axios.get(url)
        .then((response) => {
            logger(`   * Se encontraron ${response.data.data.length} publicaciones en la cuenta ${account.name}`)
            return [response.data.data, response.data.data.length];
        })
}


const filterSavedPosts = async (posts, account) => {
  const filteredPost = [];
  const result = [];
  const alreadyExists = [];
  await posts.forEach(
    async (post) => {
      filteredPost.push(
        new Promise(async (resolve, _) => {
          const savedPost = await Post.findOne({ 'fbPostId': post.id });
          if (!savedPost) {
            result.push(post);
          } else {
            alreadyExists.push(post.id)
          }
          resolve();
        })
      )
    }
  );
  return await Promise.all(filteredPost)
    .then(() => {
      logger(`   * Post que ya estaban guardados: ${alreadyExists.length} para la cuenta ${account.name}:`);
      logger(`[ ${alreadyExists.toString()} ]`)
      logger(`   * Post Filtrados que no estaban guardados: ${result.length} para la cuenta ${account.name}:`)
      if (result.length > 0) {
        const post_ids = result.map((p) => p.id)
        logger(`     * [ ${post_ids.toString()} ]\n`)
      }
      return [result, {total_guardados: alreadyExists.length, total_nuevos: result.length}];
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
        } catch (error) {
          throw error;
        }
      }
    return Promise.all(postPromise)
        .then(() => result)
}


const getPosts = async (account, startDateCampaign, endDateCampaign, lastPostDate, fbAccountId) => {
    const page_id = fbAccountId
    const page_text_id = (new URL(account.link)).pathname.replace('/','');
    const startDate = lastPostDate  ? lastPostDate : startDateCampaign;
    const endDate = new Date(endDateCampaign)
    endDate.setDate(endDate.getDate())
    const since = startDate
    const until = endDate
    let posts = []
    
    logger(`   * Buscar publicaciones en FB 
            * entre el ${since.toUTCString()} y el ${until.toUTCString()} 
            * para la cuenta ${account.name}.\n`)
  
  try {
        const [feedResponse, total_feed] = await getFeedByID(page_id, since, until, account);
        const [filteredPosts, totalesObj] = await filterSavedPosts(feedResponse, account);
        posts = await getPostDetails(filteredPosts, account);
        return [posts, {total_feed, ...totalesObj}];
      } catch (err) {
        const { error: { type, code } } = err.response.data;

        // Si falla por ID numérico se reitenta la llamada con el username.
        if (type === 'GraphMethodException' && code === 100) {
          try {
            logger(`\n   * Intento con ID: ${page_text_id}`)
            const [feedResponse, total_feed] = await getFeedByID(page_text_id, since, until, account);
            const [filteredPosts, totalesObj] = await filterSavedPosts(feedResponse, account);
            posts = await getPostDetails(filteredPosts, account);
            return [posts, {total_feed, ...totalesObj}];
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