import fs from "fs";
import path from "path";
import getAppDataPath from "appdata-path";

import Service from "./Service";
import Meta from "./Meta";

const configDir = Meta.isDevMode() ? getAppDataPath('tabs-app-dev') : getAppDataPath('tabs-app');
const configFile = path.resolve(configDir, 'config.json');

export default class Config {
    updateCheckSkip = undefined;
    securityButton = true;
    homeButton = false;
    backButton = true;
    forwardButton = false;
    refreshButton = false;

    properties = [];

    constructor() {
        // Load data from config file
        let data = {};
        if (fs.existsSync(configDir) && fs.statSync(configDir).isDirectory()) {
            if (fs.existsSync(configFile) && fs.statSync(configFile).isFile())
                data = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        } else {
            fs.mkdirSync(configDir);
        }

        // Parse services
        this.services = [];
        if (typeof data.services === 'object') {
            let i = 0;
            for (const service of data.services) {
                this.services[i] = new Service(service);
                i++;
            }
        }

        if (this.services.length === 0) {
            this.services.push(new Service('welcome', 'Welcome', 'rocket', false, 'https://github.com/ArisuOngaku/tabs', false));
        }

        this.defineProperty('updateCheckSkip', data);

        this.defineProperty('securityButton', data);
        this.defineProperty('homeButton', data);
        this.defineProperty('backButton', data);
        this.defineProperty('forwardButton', data);
        this.defineProperty('refreshButton', data);

        this.save();
    }

    save() {
        console.log('Saving config');
        this.services = this.services.filter(s => s !== null);
        fs.writeFileSync(configFile, JSON.stringify(this, null, 4));
        console.log('> Config saved to', configFile.toString());
    }

    defineProperty(name, data) {
        if (data[name] !== undefined) {
            this[name] = data[name];
        }

        this.properties.push(name);
    }

    update(data) {
        for (const prop of this.properties) {
            if (data[prop] !== undefined) {
                this[prop] = data[prop];
            }
        }
    }
}