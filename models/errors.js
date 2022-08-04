var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var errorSchema = new Schema({
    account: String,
    fbAccountId: String,
    message: String,
    type: String,
    error_subcode: String,
    code: String,
    date: Date
}, { timestamps: true, collection: 'errors' });

var Error = mongoose.model('Error', errorSchema);

module.exports = Error;
