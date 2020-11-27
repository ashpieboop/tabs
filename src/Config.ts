import fs from "fs";
import path from "path";
import getAppDataPath from "appdata-path";

import Service from "./Service";
import Meta from "./Meta";

const configDir = Meta.isDevMode() ? getAppDataPath('tabs-app-dev') : getAppDataPath('tabs-app');
const configFile = path.resolve(configDir, 'config.json');

export default class Config {
    public services: Service[] = [];

    public updateCheckSkip?: string;

    public startMinimized: boolean = false;

    public bigNavBar: boolean = false;

    public securityButton: boolean = true;
    public homeButton: boolean = false;
    public backButton: boolean = true;
    public forwardButton: boolean = false;
    public refreshButton: boolean = false;

    private properties: string[] = [];

    [p: string]: unknown;

    public constructor() {
        // Load data from config file
        let data: Record<string, unknown> = {};
        if (fs.existsSync(configDir) && fs.statSync(configDir).isDirectory()) {
            if (fs.existsSync(configFile) && fs.statSync(configFile).isFile())
                data = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        } else {
            fs.mkdirSync(configDir);
        }

        // Parse services
        if (typeof data.services === 'object' && Array.isArray(data.services)) {
            let i = 0;
            for (const service of data.services) {
                this.services[i] = new Service(service);
                i++;
            }
        }

        if (this.services.length === 0) {
            this.services.push(new Service(
                'welcome',
                'Welcome',
                'rocket',
                false,
                'https://eternae.ink/arisu/tabs',
                false,
            ));
        }

        this.defineProperty('updateCheckSkip', data);

        this.defineProperty('startMinimized', data);

        this.defineProperty('bigNavBar', data);

        this.defineProperty('securityButton', data);
        this.defineProperty('homeButton', data);
        this.defineProperty('backButton', data);
        this.defineProperty('forwardButton', data);
        this.defineProperty('refreshButton', data);

        this.save();
    }

    public save(): void {
        console.log('Saving config');
        fs.writeFileSync(configFile, JSON.stringify(this, null, 4));
        console.log('> Config saved to', configFile.toString());
    }

    public defineProperty(name: string, data: Record<string, unknown>): void {
        if (data[name] !== undefined) {
            this[name] = data[name];
        }

        this.properties.push(name);
    }

    public update(data: Record<string, unknown>): void {
        for (const prop of this.properties) {
            if (data[prop] !== undefined) {
                this[prop] = data[prop];
            }
        }
    }
}
