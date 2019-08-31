const {
    app,
    BrowserWindow,
    BrowserView,
    ipcMain
} = require('electron')

const Service = require('./Service')

const services = [];
services.push(new Service('arisucloud', 'Arisu Cloud', 'arisucloud.svg', true, 'https://cloud.arisu.fr/'));
services.push(new Service('webmail', 'WebMail', 'far fa-envelope', false, 'https://mail.arisu.fr/'));

var selectedService = 0;

var window;

function createWindow() {
    // Create the browser window.
    window = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true,
            webviewTag: true
        }
    });
    window.maximize();
    window.on('closed', () => {
        window = null;
    });
    window.webContents.openDevTools({
        mode: 'detach'
    });


    // Sync services with navigation
    window.webContents.on('dom-ready', sendServices);

    // Load navigation view
    window.loadFile('index.html');

    // Load active service
    ipcMain.on('setActiveService', (event, index) => {
        setActiveService(index);
    });
}

function sendServices() {
    window.webContents.send('services', services, selectedService);
}

function setActiveService(index) {
    selectedService = index;
}

app.on('ready', createWindow)