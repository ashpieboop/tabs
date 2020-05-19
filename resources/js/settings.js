const {ipcRenderer, remote} = require('electron');

let currentVersion;
let updateStatus;

ipcRenderer.on('current-version', (e, version) => {
    currentVersion.innerText = `Version: ${version.version}`;
});

ipcRenderer.on('updateStatus', (e, available, version) => {
    if (available) {
        updateStatus.innerHTML = `A new update is available! <a href="https://github.com/ArisuOngaku/tabs/releases/v${version}">Click here to download manually</a>.`;
    } else {
        updateStatus.innerText = 'Tabs is up to date.';
    }
});

function save() {
    const formData = new FormData(document.querySelector('form'));
    remote.getCurrentWindow().close();
}

document.addEventListener('DOMContentLoaded', () => {
    currentVersion = document.getElementById('current-version');
    updateStatus = document.getElementById('update-status');

    ipcRenderer.send('syncSettings');
    ipcRenderer.send('checkForUpdates');
});