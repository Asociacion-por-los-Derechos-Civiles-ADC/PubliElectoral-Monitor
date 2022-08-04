var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var politicalPartySchema = new Schema({
  name: String,
  campaign: {
    type: Schema.Types.ObjectId,
    ref: 'Campaign'
  },
}, { timestamps: true, collection: 'politicalParties' });


var PoliticalParty = mongoose.model('PoliticalParty', politicalPartySchema);

module.exports = PoliticalParty;
