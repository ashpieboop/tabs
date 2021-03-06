import path from "path";
import Window from "../Window";
import Application from "../Application";
import Meta from "../Meta";
import Service from "../Service";

export default class ServiceSettingsWindow extends Window {
    private readonly serviceId: number | null;

    public constructor(application: Application, parent: Window, serviceId: number | null) {
        super(application, parent);
        this.serviceId = serviceId;
    }

    public setup(): void {
        super.setup({
            webPreferences: {
                nodeIntegration: true,
                enableRemoteModule: true,
                webviewTag: true,
                contextIsolation: false,
            },
            modal: true,
            autoHideMenuBar: true,
            height: 850,
        });

        const window = this.getWindow();

        if (this.application.isDevMode()) {
            window.webContents.openDevTools({
                mode: 'right',
            });
        }

        this.onIpc('sync-settings', () => {
            window.webContents.send('syncIcons', Meta.ICON_SETS);
            window.webContents.send('loadService',
                this.serviceId, typeof this.serviceId === 'number' ?
                    this.config.services[this.serviceId] :
                    undefined,
            );
        });

        this.onIpc('saveService', (e, id: number | null, data: Service) => {
            console.log('Saving service', id, data);
            const newService = new Service(data);
            if (typeof id === 'number') {
                this.config.services[id] = newService;
            } else {
                this.config.services.push(newService);
                id = this.config.services.indexOf(newService);

                if (id < 0) id = null;
            }
            this.config.save();

            this.parent?.getWindow().webContents.send('updateService', id, newService);
        });

        window.loadFile(path.resolve(Meta.RESOURCES_PATH, 'service-settings.html'))
            .catch(console.error);
    }

}
