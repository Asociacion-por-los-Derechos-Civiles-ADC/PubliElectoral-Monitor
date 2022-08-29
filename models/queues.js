var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var queueSchema = new Schema({
  name: String,
  processed: [{
      type: Schema.Types.ObjectId,
      ref: 'Account'
  }],
  nonProcessed: [{
      type: Schema.Types.ObjectId,
      ref: 'Account'
  }],
  next: Number,
  totalAccounts: Number
}, { timestamps: true, collection: 'queues' });


var Queue = mongoose.model('Queue', queueSchema);

module.exports = Queue;
