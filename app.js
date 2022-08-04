const process         = require('process');
const mongoose        = require('mongoose');

require('./cron.js');
// require('./advertising-cron.js');

// If the Node process ends, close the Mongoose connection
process.on('SIGINT', function() {
  mongoose.connection.close(function () {
    console.log('Mongoose disconnected on app termination');
    process.exit(0);
  });
});