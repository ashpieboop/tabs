import SingleInstance from "single-instance";
import {app} from "electron";

import Meta from "./Meta";
import Application from "./Application";

// Fix for twitter (and others) in webviews - pending https://github.com/electron/electron/issues/25469
app.commandLine.appendSwitch('disable-features', 'CrossOriginOpenerPolicy');

const application = new Application(Meta.isDevMode());

// Check if application is already running
const lock = new SingleInstance('tabs-app');
lock.lock().then(() => {
    app.on('ready', () => {
        application.start().catch(console.error);
    });
}).catch(err => {
    console.error(err);
    process.exit(0);
});
