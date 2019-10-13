const fs = require('fs');
const path = require('path');

const Service = require('./Service');

const configDir = path.resolve(__dirname, '../config');
const configFile = path.resolve(configDir, 'config.json');

class Config {
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
            this.services.push(new Service('webmail', 'WebMail', 'far fa-envelope', false, 'https://mail.arisu.fr/', true));
            this.services.push(new Service('arisucloud', 'Arisu Cloud', 'arisucloud.svg', true, 'https://cloud.arisu.fr/', true));
        }

        this.save();
    }

    save() {
        fs.writeFileSync(configFile, JSON.stringify(this, null, 4));
    }
}

module.exports = Config;