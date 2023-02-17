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
  quarentine: [{
    type: Schema.Types.ObjectId,
    ref: 'Account'
  }],
  manually: [{
    type: Schema.Types.ObjectId,
    ref: 'Account',
    require: false
  }],
  next: Number,
  totalAccounts: Number,
  lastRangeExecute: []
}, { timestamps: true, collection: 'queues' });


var Queue = mongoose.model('Queue', queueSchema);

module.exports = Queue;
