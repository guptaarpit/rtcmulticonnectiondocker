'use strict'
const fs = require('fs')
const fsPromise = fs.promises;
const config = require('./config.json')
module.exports = async () => {
  let options = {
    key: await fsPromise.readFile('./ssl/optimizevents.key'),
    cert: await fsPromise.readFile('./ssl/1e3ad6daa1a8f5ba.pem'),
    ca: await fsPromise.readFile('./ssl/gd_bundle-g2-g1.crt')
  };

  let pfx = false;

  if (!fs.existsSync(config.sslKey)) {
    console.log(BASH_COLORS_HELPER.getRedFG(), 'sslKey:\t ' + config.sslKey + ' does not exist.');
  } else {
    pfx = config.sslKey.indexOf('.pfx') !== -1;
    options.key = await fsPromise.readFile(config.sslKey);
  }

  if (!fs.existsSync(config.sslCert)) {
    console.log(BASH_COLORS_HELPER.getRedFG(), 'sslCert:\t ' + config.sslCert + ' does not exist.');
  } else {
    options.cert = await fsPromise.readFile(config.sslCert);
  }

  if (config.sslCabundle) {
    if (!fs.existsSync(config.sslCabundle)) {
      console.log(BASH_COLORS_HELPER.getRedFG(), 'sslCabundle:\t ' + config.sslCabundle + ' does not exist.');
    }

    options.ca = await fsPromise.readFile(config.sslCabundle);
  }

  if (pfx === true) {
    options = {
      pfx: config.sslKey
    };
  }
  return options;
}