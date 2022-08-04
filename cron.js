'use strict';
require('dotenv').load();

const CronJob     = require('cron').CronJob;
const facebookAPI = require('./lib/facebook-api.js');
const script      = require('./lib/script.js');
const monitor = require('./lib/monitoreo.js');

var checkingPostEach5MinutesJob = new CronJob({
  cronTime: process.env.CHECK_INTERVAL_MINUTES,
  onTick: function() {
    // script.checkPosts(facebookAPI);
    monitor.checkPosts(facebookAPI);
  },
  start: false,
  timeZone: 'America/Argentina/Buenos_Aires'
});

checkingPostEach5MinutesJob.start();
