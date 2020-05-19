import {autoUpdater} from "electron-updater";

export default class Updater {
    #callback = (available, data) => {
        console.log('Update:', available, data);
    };

    constructor() {
        autoUpdater.autoDownload = false;
        autoUpdater.on('error', err => {
            this.#callback(false, err);
        });
        autoUpdater.on('update-available', v => {
            this.#callback(true, v);
        });
        autoUpdater.on('update-not-available', () => {
            this.#callback(false);
        });
    }

    /**
     * @param {Function} callback
     */
    checkForUpdates(callback) {
        this.#callback = callback;
        autoUpdater.checkForUpdates().then(r => {
            this.#callback(false, r.updateInfo);
        }).catch(err => {
            this.#callback(false, err);
        });
    }

    getCurrentVersion() {
        return autoUpdater.currentVersion;
    }
}