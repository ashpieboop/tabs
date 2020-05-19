import {autoUpdater} from "electron-updater";

export default class Updater {
    #updateInfo;

    constructor() {
        autoUpdater.autoDownload = false;
        autoUpdater.on('error', err => {
            this.notifyUpdate(false, err);
        });
        autoUpdater.on('update-available', v => {
            this.notifyUpdate(true, v);
        });
        autoUpdater.on('update-not-available', () => {
            this.notifyUpdate(false);
        });
    }

    /**
     * @param {Function} callback
     */
    checkForUpdates(callback) {
        if (this.#updateInfo) {
            callback(this.#updateInfo.version !== this.getCurrentVersion().raw, this.#updateInfo);
            return;
        }

        autoUpdater.checkForUpdates().then(r => {
            this.#updateInfo = r.updateInfo;
            callback(r.updateInfo.version !== this.getCurrentVersion().raw, r.updateInfo);
        }).catch(err => {
            callback(false, err);
        });
    }

    getCurrentVersion() {
        return autoUpdater.currentVersion;
    }

    notifyUpdate(available, data) {
        console.log('Update:', available, data);
    }
}