import SingleInstance from "single-instance";
import {app} from "electron";

import Meta from "./Meta";
import Application from "./Application";

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
