import {Event} from "electron";
import path from "path";
import Window from "../Window";
import MainWindow from "./MainWindow";
import Meta from "../Meta";
import Config from "../Config";

export default class SettingsWindow extends Window {
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

        this.onIpc('syncSettings', () => {
            window.webContents.send('current-version', this.application.getUpdater().getCurrentVersion());
            window.webContents.send('config', this.config);
        });

        this.onIpc('checkForUpdates', () => {
            this.application.getUpdater().checkForUpdates().then(updateInfo => {
                window.webContents.send('updateStatus', typeof updateInfo === 'object', updateInfo);
            }).catch(console.error);
        });

        this.onIpc('save-config', (e: Event, data: Config) => {
            this.config.update(data);
            this.config.save();
            if (this.parent instanceof MainWindow) {
                this.parent.syncData();
            }
        });

        window.loadFile(path.resolve(Meta.RESOURCES_PATH, 'settings.html'))
            .catch(console.error);
    }
}
