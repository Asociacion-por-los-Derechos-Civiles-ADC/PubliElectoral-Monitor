'use strict';
require('dotenv').load();

const CronJob           = require('cron').CronJob;
const facebookAPI       = require('./lib/facebook-api.js');
const advertisingScript = require('./lib/advertising-script.js');

var checkingPostEach5MinutesJob = new CronJob({
  cronTime: process.env.CHECK_ADVERTISING_INTERVAL_MINUTES,
  onTick: function() {
    advertisingScript.searchAdvertisements(facebookAPI);
  },
  start: false,
  timeZone: 'America/Argentina/Buenos_Aires'
});

checkingPostEach5MinutesJob.start();
