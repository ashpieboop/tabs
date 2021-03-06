import {ipcRenderer, shell} from "electron";
import Config from "../../src/Config";
import {SemVer} from "semver";
import {UpdateInfo} from "electron-updater";

let currentVersion: HTMLElement | null;
let updateStatus: HTMLElement | null;
let updateInfo: UpdateInfo;
let updateButton: HTMLElement | null;
let config: Config;

let startMinimizedField: HTMLInputElement | null;

let bigNavBarField: HTMLInputElement | null;

let securityButtonField: HTMLInputElement | null,
    homeButtonField: HTMLInputElement | null,
    backButtonField: HTMLInputElement | null,
    forwardButtonField: HTMLInputElement | null,
    refreshButtonField: HTMLInputElement | null;

ipcRenderer.on('current-version', (e, version: SemVer) => {
    if (currentVersion) currentVersion.innerText = `Version: ${version.version}`;
});

ipcRenderer.on('config', (e, c: Config) => {
    config = c;
    if (startMinimizedField) startMinimizedField.checked = config.startMinimized;

    if (bigNavBarField) bigNavBarField.checked = config.bigNavBar;

    if (securityButtonField) securityButtonField.checked = config.securityButton;
    if (homeButtonField) homeButtonField.checked = config.homeButton;
    if (backButtonField) backButtonField.checked = config.backButton;
    if (forwardButtonField) forwardButtonField.checked = config.forwardButton;
    if (refreshButtonField) refreshButtonField.checked = config.refreshButton;
});

ipcRenderer.on('updateStatus', (e, available: boolean, version: UpdateInfo) => {
    console.log(available, version);
    updateInfo = version;
    if (available) {
        if (updateStatus) updateStatus.innerHTML = 'A new update is available!';
        if (updateButton) updateButton.classList.remove('hidden');
    } else {
        if (updateStatus) updateStatus.innerText = 'Tabs is up to date.';
    }
});

function save() {
    const form = document.querySelector('form');
    if (!form) return;
    const formData = new FormData(form);

    config.startMinimized = formData.get('start-minimized') === 'on';

    config.bigNavBar = formData.get('big-nav-bar') === 'on';

    config.securityButton = formData.get('security-button') === 'on';
    config.homeButton = formData.get('home-button') === 'on';
    config.backButton = formData.get('back-button') === 'on';
    config.forwardButton = formData.get('forward-button') === 'on';
    config.refreshButton = formData.get('refresh-button') === 'on';

    ipcRenderer.send('save-config', config);
    ipcRenderer.send('close-window', 'SettingsWindow');
}

document.addEventListener('DOMContentLoaded', () => {
    currentVersion = document.getElementById('current-version');
    updateStatus = document.getElementById('update-status');
    updateButton = document.getElementById('download-button');
    updateButton?.addEventListener('click', () => {
        shell.openExternal(`https://update.eternae.ink/ashpie/tabs/${updateInfo.path}`)
            .catch(console.error);
    });

    startMinimizedField = <HTMLInputElement>document.getElementById('start-minimized');

    bigNavBarField = <HTMLInputElement>document.getElementById('big-nav-bar');

    securityButtonField = <HTMLInputElement>document.getElementById('security-button');
    homeButtonField = <HTMLInputElement>document.getElementById('home-button');
    backButtonField = <HTMLInputElement>document.getElementById('back-button');
    forwardButtonField = <HTMLInputElement>document.getElementById('forward-button');
    refreshButtonField = <HTMLInputElement>document.getElementById('refresh-button');

    document.getElementById('cancel-button')?.addEventListener('click', e => {
        e.preventDefault();
        ipcRenderer.send('close-window', 'SettingsWindow');
    });

    document.querySelector('form')?.addEventListener('submit', e => {
        e.preventDefault();
        save();
    });

    ipcRenderer.send('syncSettings');
    ipcRenderer.send('checkForUpdates');
});
