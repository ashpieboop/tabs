const {ipcRenderer, remote, shell} = require('electron');

let currentVersion;
let updateStatus;
let updateInfo;
let updateButton;

ipcRenderer.on('current-version', (e, version) => {
    currentVersion.innerText = `Version: ${version.version}`;
});

ipcRenderer.on('updateStatus', (e, available, version) => {
    console.log(available, version);
    updateInfo = version;
    if (available) {
        updateStatus.innerHTML = 'A new update is available!';
        updateButton.classList.remove('hidden');
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
    updateButton = document.getElementById('download-button');
    updateButton.addEventListener('click', () => {
        shell.openExternal(`https://github.com/ArisuOngaku/tabs/releases/tag/v${updateInfo.version}`)
            .catch(console.error);
    });

    ipcRenderer.send('syncSettings');
    ipcRenderer.send('checkForUpdates');
});