var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var campaignSchema = new Schema({
  name: String,
  startDate: Date,
  endDate: Date
}, { timestamps: true, collection: 'campaigns' });

var Campaign = mongoose.model('Campaign', campaignSchema);

module.exports = Campaign;
