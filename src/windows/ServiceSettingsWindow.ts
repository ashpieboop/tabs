import path from "path";
import Window from "../Window";
import Application from "../Application";
import Meta from "../Meta";
import Service from "../Service";

export default class ServiceSettingsWindow extends Window {
    private readonly serviceId: number;

    constructor(application: Application, parent: Window, serviceId: number) {
        super(application, parent);
        this.serviceId = serviceId;
    }

    public setup() {
        super.setup({
            webPreferences: {
                nodeIntegration: true,
                enableRemoteModule: true,
                webviewTag: true,
            },
            modal: true,
            autoHideMenuBar: true,
            height: 850,
        });

        const window = this.getWindow();

        if (this.application.isDevMode()) {
            window.webContents.openDevTools({
                mode: 'right'
            });
        }

        this.onIpc('sync-settings', () => {
            window.webContents.send('syncIcons', Meta.BRAND_ICONS, Meta.SOLID_ICONS);
            window.webContents.send('loadService', this.serviceId, this.config.services[this.serviceId]);
        });

        this.onIpc('saveService', (e, id, data) => {
            console.log('Saving service', id, data);
            const newService = new Service(data);
            if (typeof id === 'number') {
                this.config.services[id] = newService;
            } else {
                this.config.services.push(newService);
                id = this.config.services.indexOf(newService);
            }
            this.config.save();

            this.parent?.getWindow().webContents.send('updateService', id, newService);
        });

        window.loadFile(path.resolve(Meta.RESOURCES_PATH, 'service-settings.html'))
            .catch(console.error);
    }

}