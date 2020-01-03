#!/bin/electron
const SingleInstance = require('single-instance');
const lock = new SingleInstance('tabs-app');
lock.lock().then(() => {
    require = require("esm")(module);
    module.exports = require("./src/main.js");
}).catch(error => {
    console.error(error);
    process.exit(0);
});