'use strict';
require('dotenv').load();

const mongoose            = require('mongoose');
const Advertising         = require('../models/advertising');
const Account             = require('../models/account');
Promise                   = require('bluebird');
mongoose.Promise          = Promise;
mongoose.Promise = Promise;


const logger = str => console.log(str);

const openConnection = () => {
    mongoose.connect(`mongodb://localhost:27017/publielectoral`, {useNewUrlParser: true});
    // mongoose.connect(`mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}/${process.env.DB_NAME}`, {useNewUrlParser: true});
    logger('==================================================');
    logger(`  Conectado a mongo ${new Date()}`);
};

const getAllAds = async () => {
    const ads = await Advertising.find({
        'politicalParty': {'$exists': false}
    });
    logger(`  Hay ${ads.length} ads para actualizar.`);
    return ads;
};

const updateAdsParties = async (ads) => {
    const promises = [];
    ads.forEach((ad) => {
        promises.push(
            new Promise(
                async (resolve, _) => {
                    const account = await Account.findOne({
                        'fbAccountId': ad.fbAccountId
                    })
                    if (account) {
                        const id = mongoose.Types.ObjectId(ad._id);
                        const filter = {_id: id};
                        const update = {$set: {politicalParty: account.politicalParty}};
                        const options = { new: true }; 
                        await Advertising.update(filter, update, options);
                        logger(`    AD ${ad._id} actualizada con partido: ${account.politicalParty} de cuenta: ${account.name}`);
                    } else {
                        // logger(ad)
                        logger(`    AD ${ad._id} no se encontro la cuenta de nombre ${ad.ad_account_name} en la DB`);
                    }
                    resolve();
                }
            )
        );
    });
    await Promise.all(promises);
};


const updateParties = async () => {
    openConnection();
    const ads = await getAllAds();
    await updateAdsParties(ads);
    logger(' Fin de ejecución')
};


updateParties();

module.exports = {
    updateParties
}
