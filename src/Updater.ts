import {autoUpdater, UpdateInfo} from "electron-updater";
import {dialog, shell} from "electron";
import Config from "./Config";
import BrowserWindow = Electron.BrowserWindow;
import Application from "./Application";

export default class Updater {
    private readonly config: Config;
    private readonly application: Application;
    private updateInfo?: UpdateInfo;

    public constructor(config: Config, application: Application) {
        this.config = config;
        this.application = application;

        // Configure auto updater
        autoUpdater.autoDownload = false;
        autoUpdater.on('error', err => {
            console.log('Error while checking for updates', err);
        });
        autoUpdater.on('update-available', v => {
            console.log('Update available', v);
        });
        autoUpdater.on('update-not-available', () => {
            console.log('No update available.');
        });
    }

    public async checkForUpdates(force: boolean = false): Promise<UpdateInfo | void> {
        if (force || !this.updateInfo) {
            this.updateInfo = (await autoUpdater.checkForUpdates()).updateInfo;
        }

        if (this.updateInfo.version !== this.getCurrentVersion().raw) {
            return this.updateInfo;
        }
    }

    public getCurrentVersion() {
        return autoUpdater.currentVersion;
    }

    public async checkAndPromptForUpdates(mainWindow: BrowserWindow): Promise<void> {
        const updateInfo = await this.checkForUpdates(true);

        if (updateInfo && updateInfo.version !== this.config.updateCheckSkip) {
            const input = await dialog.showMessageBox(mainWindow, {
                message: `Version ${updateInfo.version} of tabs is available. Do you wish to install this update?`,
                buttons: [
                    'Cancel',
                    'Install',
                ],
                checkboxChecked: false,
                checkboxLabel: `Don't remind me for this version`,
                cancelId: 0,
                defaultId: 1,
                type: 'question'
            });

            if (input.checkboxChecked) {
                console.log('Skipping update download prompt for version', updateInfo.version);
                this.config.updateCheckSkip = updateInfo.version;
                this.config.save();
            }

            if (input.response === 1) {
                await this.application.stop();
                await autoUpdater.downloadUpdate();
                autoUpdater.quitAndInstall();
            }
        }
    }
}
