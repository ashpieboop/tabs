const {
    app,
    BrowserWindow,
    ipcMain,
} = require('electron');
const path = require('path');
const Config = require('./Config');

const resourcesDir = path.resolve(__dirname, '../resources');

const config = new Config();

let selectedService = 0;

let window;
let addServiceWindow;

function createWindow() {
    // Create the browser window.
    window = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true,
            webviewTag: true,
        },
        autoHideMenuBar: true,
    });
    window.maximize();
    window.on('closed', () => {
        window = null;
    });

    if (process.argv.length > 2 && process.argv[2] === '--dev') {
        window.webContents.openDevTools({
            mode: 'right'
        });
    }


    // Sync services with navigation
    window.webContents.on('dom-ready', sendServices);

    // Load navigation view
    window.loadFile(path.resolve(resourcesDir, 'index.html'))
        .catch(console.error);

    // Load active service
    ipcMain.on('setActiveService', (event, index) => {
        setActiveService(index);
    });

    // Set a service's favicon
    ipcMain.on('setServiceFavicon', (event, index, favicon) => {
        config.services[index].favicon = favicon;
        config.save();
    });

    // Open add service window
    ipcMain.on('openAddServiceWindow', () => {
        if (!addServiceWindow) {
            addServiceWindow = new BrowserWindow({
                parent: window,
                modal: true,
                autoHideMenuBar: true,
            });
            addServiceWindow.on('close', () => {
                addServiceWindow = null;
            });
            addServiceWindow.loadFile(path.resolve(resourcesDir, 'add-service.html'))
                .catch(console.error);
        }
    });
}

function sendServices() {
    window.webContents.send('services', config.services, selectedService);
}

function setActiveService(index) {
    selectedService = index;
}

app.on('ready', createWindow);