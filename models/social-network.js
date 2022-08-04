var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var socialNetworkSchema = new Schema({
  name: String,
}, { timestamps: true, collection: 'socialNetworks' });

var SocialNetwork = mongoose.model('SocialNetwork', socialNetworkSchema);

module.exports = SocialNetwork;
