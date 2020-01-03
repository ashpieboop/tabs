import fs from "fs";
import path from "path";
import {app, BrowserWindow, ipcMain, Menu, Tray} from "electron";

import Config from "./Config";

const resourcesDir = path.resolve(__dirname, '../resources');
const iconPath = path.resolve(resourcesDir, 'logo.png');

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
            addServiceWindow.webContents.on('dom-ready', () => {
                addServiceWindow.webContents.send('syncIcons', listIcons('brands'), listIcons('solid'));
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

function listIcons(set) {
    const directory = path.resolve(resourcesDir, 'icons/' + set);
    const icons = [];
    fs.readdirSync(directory).forEach(i => icons.push(i.split('.svg')[0]));
    return icons;
}

app.on('ready', createWindow);