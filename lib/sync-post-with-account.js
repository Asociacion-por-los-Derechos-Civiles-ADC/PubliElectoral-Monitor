'use strict';
require('dotenv').load();

const mongoose            = require('mongoose');
const Post                = require('../models/post');
const Account             = require('../models/account');
Promise                   = require('bluebird');
mongoose.Promise          = Promise;


function openConnection() {
  mongoose.connect(`mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}/${process.env.DB_NAME}`, {useNewUrlParser: true});
  console.log('================================================== \n');
  console.log(`Database connectionn is open ${new Date()}`);
}

function closeConnection() {
  mongoose.connection.close()
  console.log('Database connection is close \n');
  console.log('================================================== \n');
}

async function synchronizePostWithAccount() {
  openConnection();
  let postsWithAccount = await fetchPostWithoutAccount()

  console.log(postsWithAccount.length, ' posts has been found')
  if (postsWithAccount.length === 0) {
    console.log("Didn't find post without account");
    closeConnection()
  }

  let updatedPosts = postsWithAccount.map(async post => {
    let accountFound = await fetchAccountForPost(post)
    await updatePostWithAccount(post, accountFound)
  })
}

async function updatePostWithAccount(post, account) {
  console.log('updating posts...');
  await Post.findOneAndUpdate(
    { '_id': post._id },
    { '$set': { account: account._id } }
  )
  console.log('post has been updated');
}

async function fetchPostWithoutAccount() {
  console.log('Searching posts without an account');
  let posts = await Post.find({ 'account': { '$eq': null } })
  return posts
}

async function fetchAccountForPost(post) {
  console.log('Searching an account for a post');
  let account = await Account.find({ 'fbAccountId': post.fbAccountId })
  console.log('Account has been found');
  return account[0]
}

module.exports = {
  synchronizePostWithAccount
}
