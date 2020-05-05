import fs from "fs";
import path from "path";
import {homedir} from "os";

import Service from "./Service";
import Meta from "./Meta";

const configDir = Meta.isDevMode() ? path.resolve(homedir(), '.config/tabs-app-dev') : path.resolve(homedir(), '.config/tabs-app');
const configFile = path.resolve(configDir, 'config.json');

export default class Config {
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

        this.save();
    }

    save() {
        console.log('Saving config');
        this.services = this.services.filter(s => s !== null);
        fs.writeFileSync(configFile, JSON.stringify(this, null, 4));
        console.log('> Config saved to', configFile.toString());
    }
}