const {ipcRenderer, remote, shell} = require('electron');

let currentVersion;
let updateStatus;
let updateInfo;
let updateButton;
let config;

let securityButtonField, homeButtonField, backButtonField, forwardButtonField, refreshButtonField;

ipcRenderer.on('current-version', (e, version) => {
    currentVersion.innerText = `Version: ${version.version}`;
});

ipcRenderer.on('config', (e, c) => {
    config = c;
    securityButtonField.checked = config.securityButton;
    homeButtonField.checked = config.homeButton;
    backButtonField.checked = config.backButton;
    forwardButtonField.checked = config.forwardButton;
    refreshButtonField.checked = config.refreshButton;
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

    config.securityButton = formData.get('security-button') === 'on';
    config.homeButton = formData.get('home-button') === 'on';
    config.backButton = formData.get('back-button') === 'on';
    config.forwardButton = formData.get('forward-button') === 'on';
    config.refreshButton = formData.get('refresh-button') === 'on';

    ipcRenderer.send('save-config', config);
    remote.getCurrentWindow().close();
}

document.addEventListener('DOMContentLoaded', () => {
    currentVersion = document.getElementById('current-version');
    updateStatus = document.getElementById('update-status');
    updateButton = document.getElementById('download-button');
    updateButton.addEventListener('click', () => {
        shell.openExternal(`https://github.com/ArisuOngaku/tabs/releases/download/v${updateInfo.version}/${updateInfo.path}`)
            .catch(console.error);
    });

    securityButtonField = document.getElementById('security-button');
    homeButtonField = document.getElementById('home-button');
    backButtonField = document.getElementById('back-button');
    forwardButtonField = document.getElementById('forward-button');
    refreshButtonField = document.getElementById('refresh-button');

    ipcRenderer.send('syncSettings');
    ipcRenderer.send('checkForUpdates');
});