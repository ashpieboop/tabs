const {
    app,
    BrowserWindow,
    ipcMain,
    Tray,
    Menu,
} = require('electron');
const fs = require('fs');
const path = require('path');
const Config = require('./Config');

const resourcesDir = path.resolve(__dirname, '../resources');

const config = new Config();

const devMode = process.argv.length > 2 && process.argv[2] === '--dev';

let selectedService = 0;

let tray;
let window;
let addServiceWindow;

function toggleMainWindow() {
    if (window != null) {
        if (!window.isFocused()) {
            window.show();
        } else {
            window.hide();
        }
    }
}

function createWindow() {
    // System tray
    tray = new Tray(path.resolve(resourcesDir, 'logo.png'));
    tray.setToolTip('Tabs');
    tray.setContextMenu(Menu.buildFromTemplate([
        {label: 'Tabs', enabled: false},
        {label: 'Open Tabs', click: () => window.show()},
        {type: 'separator'},
        {label: 'Quit', role: 'quit'}
    ]));
    tray.on('click', () => toggleMainWindow());

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

    if (devMode) {
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
                webPreferences: {
                    nodeIntegration: true,
                    enableRemoteModule: true,
                    webviewTag: true,
                },
                parent: window,
                modal: true,
                autoHideMenuBar: true,
            });
            addServiceWindow.on('close', () => {
                addServiceWindow = null;
            });
            if (devMode) {
                addServiceWindow.webContents.openDevTools({
                    mode: 'right'
                });
            }
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