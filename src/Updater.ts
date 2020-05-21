import {autoUpdater, UpdateInfo} from "electron-updater";

export default class Updater {
    private updateInfo?: UpdateInfo;

    constructor() {
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

    /**
     * @param {Function} callback
     */
    checkForUpdates(callback: UpdateCheckCallback) {
        if (this.updateInfo) {
            callback(this.updateInfo.version !== this.getCurrentVersion().raw, this.updateInfo);
            return;
        }

        autoUpdater.checkForUpdates().then(r => {
            this.updateInfo = r.updateInfo;
            callback(r.updateInfo.version !== this.getCurrentVersion().raw, r.updateInfo);
        }).catch(err => {
            callback(false, err);
        });
    }

    getCurrentVersion() {
        return autoUpdater.currentVersion;
    }
}

export type UpdateCheckCallback = (available: boolean, data: UpdateInfo) => void;
