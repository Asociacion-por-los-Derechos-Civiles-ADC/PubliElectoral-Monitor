var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var accountSchema = new Schema({
  name: String,
  link: String,
  fbAccountId: String,
  politicalParty: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PoliticalParty'
  },
  socialNetwork: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SocialNetwork'
  },
  campaigns: [{
    type: Schema.Types.ObjectId,
    ref: 'Campaign'
  }],
  processed: Boolean,
  lastDateProcessed: Date
}, { timestamps: true, collection: 'accounts' });


var Account = mongoose.model('Account', accountSchema);

module.exports = Account;
