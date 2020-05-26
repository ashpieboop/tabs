import {ipcRenderer, remote, shell} from "electron";

let currentVersion: HTMLElement | null;
let updateStatus: HTMLElement | null;
let updateInfo: any;
let updateButton: HTMLElement | null;
let config: any;

let securityButtonField: HTMLInputElement | null,
    homeButtonField: HTMLInputElement | null,
    backButtonField: HTMLInputElement | null,
    forwardButtonField: HTMLInputElement | null,
    refreshButtonField: HTMLInputElement | null;

ipcRenderer.on('current-version', (e, version) => {
    if (currentVersion) currentVersion.innerText = `Version: ${version.version}`;
});

ipcRenderer.on('config', (e, c) => {
    config = c;
    if (securityButtonField) securityButtonField.checked = config.securityButton;
    if (homeButtonField) homeButtonField.checked = config.homeButton;
    if (backButtonField) backButtonField.checked = config.backButton;
    if (forwardButtonField) forwardButtonField.checked = config.forwardButton;
    if (refreshButtonField) refreshButtonField.checked = config.refreshButton;
});

ipcRenderer.on('updateStatus', (e, available, version) => {
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
    let form = document.querySelector('form');
    if (!form) return;
    const formData = new FormData(form);

    config.securityButton = formData.get('security-button') === 'on';
    config.homeButton = formData.get('home-button') === 'on';
    config.backButton = formData.get('back-button') === 'on';
    config.forwardButton = formData.get('forward-button') === 'on';
    config.refreshButton = formData.get('refresh-button') === 'on';

    ipcRenderer.send('save-config', config);
    remote.getCurrentWindow().close();
};

document.addEventListener('DOMContentLoaded', () => {
    currentVersion = document.getElementById('current-version');
    updateStatus = document.getElementById('update-status');
    updateButton = document.getElementById('download-button');
    updateButton?.addEventListener('click', () => {
        shell.openExternal(`https://github.com/ArisuOngaku/tabs/releases/download/v${updateInfo.version}/${updateInfo.path}`)
            .catch(console.error);
    });

    securityButtonField = <HTMLInputElement>document.getElementById('security-button');
    homeButtonField = <HTMLInputElement>document.getElementById('home-button');
    backButtonField = <HTMLInputElement>document.getElementById('back-button');
    forwardButtonField = <HTMLInputElement>document.getElementById('forward-button');
    refreshButtonField = <HTMLInputElement>document.getElementById('refresh-button');

    document.getElementById('cancel-button')?.addEventListener('click', e => {
        e.preventDefault();
        remote.getCurrentWindow().close();
    });

    document.querySelector('form')?.addEventListener('submit', e => {
        e.preventDefault();
        save();
    });

    ipcRenderer.send('syncSettings');
    ipcRenderer.send('checkForUpdates');
});