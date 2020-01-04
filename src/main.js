import fs from "fs";
import path from "path";
import {app, BrowserWindow, ipcMain, Menu, shell, Tray} from "electron";

import Config from "./Config";
import Service from "./Service";

const resourcesDir = path.resolve(__dirname, '../resources');
const iconPath = path.resolve(resourcesDir, 'logo.png');

const config = new Config();

const devMode = process.argv.length > 2 && process.argv[2] === '--dev';

// Load icons
const brandIcons = listIcons('brands');
const solidIcons = listIcons('solid');

let selectedService = 0;

let tray;
let window;
let serviceSettingsWindow;

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
    tray = new Tray(iconPath);
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
        icon: iconPath,
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

    // Open external links in default OS browser
    app.on('web-contents-created', (e, contents) => {
        if (contents.getType() === 'webview') {
            contents.on('new-window', (e, url) => {
                e.preventDefault();
                shell.openExternal(url);
            });
        }
    });

    // Sync services with navigation
    window.webContents.on('dom-ready', sendData);

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
    ipcMain.on('openServiceSettings', (e, serviceId) => {
        if (!serviceSettingsWindow) {
            serviceSettingsWindow = new BrowserWindow({
                webPreferences: {
                    nodeIntegration: true,
                    enableRemoteModule: true,
                    webviewTag: true,
                },
                parent: window,
                modal: true,
                autoHideMenuBar: true,
                height: 850,
            });
            serviceSettingsWindow.on('close', () => {
                serviceSettingsWindow = null;
            });
            if (devMode) {
                serviceSettingsWindow.webContents.openDevTools({
                    mode: 'right'
                });
            }
            serviceSettingsWindow.webContents.on('dom-ready', () => {
                serviceSettingsWindow.webContents.send('syncIcons', brandIcons, solidIcons);
                serviceSettingsWindow.webContents.send('loadService', serviceId, config.services[serviceId]);
            });
            serviceSettingsWindow.loadFile(path.resolve(resourcesDir, 'service-settings.html'))
                .catch(console.error);
        }
    });

    ipcMain.on('saveService', (e, id, data) => {
        const newService = new Service(data);
        if (typeof id === 'number') {
            config.services[id] = newService;
        } else {
            config.services.push(newService);
        }
        config.save();

        window.webContents.send('updateService', id, newService);
    });

    ipcMain.on('deleteService', (e, id) => {
        delete config.services[id];
        config.save();

        window.webContents.send('deleteService', id);
    });
}

function sendData() {
    window.webContents.send('data', brandIcons, solidIcons, config.services, selectedService);
}

function setActiveService(index) {
    selectedService = index;
}

function listIcons(set) {
    const directory = path.resolve(resourcesDir, 'icons/' + set);
    const icons = [];
    const dir = set === 'brands' ? 'fab' : 'fas';
    fs.readdirSync(directory).forEach(i => icons.push({
        name: i.split('.svg')[0],
        faIcon: dir + ' fa-' + i.split('.svg')[0],
    }));
    return icons;
}

app.on('ready', createWindow);