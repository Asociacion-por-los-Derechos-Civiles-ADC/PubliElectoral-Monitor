var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var postSchema = new Schema({
  text: String,
  publicDate: Date,
  image: String,
  postLink: String,
  fbPostId: String,
  fbAccountId: String,
  localImgUrl: String,
  account: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account'
  },
  campaign: {
    type: Schema.Types.ObjectId,
    ref: 'Campaign'
  },
  politicalParty: {
    type: Schema.Types.ObjectId,
    ref: 'PoliticalParty'
  },
  group: {
    num: Number,
    total: Number
  }
}, { timestamps: true, collection: 'posts' });

var Post = mongoose.model('Post', postSchema);

module.exports = Post;
