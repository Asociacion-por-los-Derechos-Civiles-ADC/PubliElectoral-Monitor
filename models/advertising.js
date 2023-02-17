var mongoose = require('mongoose');
var {Schema} = mongoose;

var AdvertisingSchema = new Schema({
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    require: false
  },
  fbAccountId: String,
  visualizedDate: Date,
  fbPostId: String,
  userGlobalLocation: String,
  userSelectedLocation: String,
  orphan: Boolean,
  campaign: {
    type: Schema.Types.ObjectId,
    ref: 'Campaign'
  },
  politicalParty: {
    type: Schema.Types.ObjectId,
    ref: 'PoliticalParty',
    required: false
  }
}, {timestamps: true,
  collection: 'advertisings'});

var Advertising = mongoose.model('advertising', AdvertisingSchema);

module.exports = Advertising;
