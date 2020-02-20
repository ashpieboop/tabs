import fs from "fs";
import path from "path";
import {app, BrowserWindow, ipcMain, Menu, shell, Tray} from "electron";

import Meta from "./Meta";
import Config from "./Config";
import Service from "./Service";

const resourcesDir = path.resolve(__dirname, '../resources');
const iconPath = path.resolve(resourcesDir, 'logo.png');

const config = new Config();

const devMode = Meta.isDevMode();

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
            console.log('Showing main window');
            window.show();
        } else {
            console.log('Hiding main window');
            window.hide();
        }
    }
}

function createWindow() {
    // System tray
    console.log('Loading system Tray');
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
    console.log('Creating main window');
    window = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true,
            webviewTag: true,
        },
        autoHideMenuBar: true,
        icon: iconPath,
        title: Meta.title,
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
            console.log('Setting external links to open in default OS browser');
            contents.on('new-window', (e, url) => {
                e.preventDefault();
                shell.openExternal(url);
            });
        }
    });

    // Sync data
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
        console.log('Setting service', index, 'favicon', favicon);
        config.services[index].favicon = favicon;
        config.save();
    });

    // Open add service window
    ipcMain.on('openServiceSettings', (e, serviceId) => {
        if (!serviceSettingsWindow) {
            console.log('Opening service settings', serviceId);
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
            let syncListener;
            ipcMain.on('sync-settings', syncListener = () => {
                serviceSettingsWindow.webContents.send('syncIcons', brandIcons, solidIcons);
                serviceSettingsWindow.webContents.send('loadService', serviceId, config.services[serviceId]);
            });
            serviceSettingsWindow.on('close', () => {
                ipcMain.removeListener('sync-settings', syncListener);
            });
            serviceSettingsWindow.loadFile(path.resolve(resourcesDir, 'service-settings.html'))
                .catch(console.error);
        }
    });

    ipcMain.on('saveService', (e, id, data) => {
        console.log('Saving service', id, data);
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
        console.log('Deleting service', id);
        delete config.services[id];
        config.save();

        window.webContents.send('deleteService', id);
    });

    ipcMain.on('reorderService', (e, serviceId, targetId) => {
        console.log('Reordering services', serviceId, targetId);

        const oldServices = config.services;
        config.services = [];

        for (let i = 0; i < targetId; i++) {
            if (i !== serviceId) {
                config.services.push(oldServices[i]);
            }
        }
        config.services.push(oldServices[serviceId]);
        for (let i = targetId; i < oldServices.length; i++) {
            if (i !== serviceId) {
                config.services.push(oldServices[i]);
            }
        }

        e.reply('reorderService', serviceId, targetId);
        config.save();
    });

    ipcMain.on('updateWindowTitle', (event, serviceId, viewTitle) => {
        if (serviceId === null) {
            window.setTitle(Meta.title);
        } else {
            const service = config.services[serviceId];
            window.setTitle(Meta.getTitleForService(service, viewTitle));
        }
    });

    console.log('> App started');
}

function sendData() {
    console.log('Syncing data');
    window.webContents.send('data', Meta.title, brandIcons, solidIcons, config.services, selectedService, path.resolve(resourcesDir, 'empty.html'));
}

function setActiveService(index) {
    console.log('Selected service is now', index);
    selectedService = index;
}

function listIcons(set) {
    console.log('Loading icon set', set);
    const directory = path.resolve(resourcesDir, 'icons/' + set);
    const icons = [];
    const dir = set === 'brands' ? 'fab' : 'fas';
    fs.readdirSync(directory).forEach(i => icons.push({
        name: i.split('.svg')[0],
        faIcon: dir + ' fa-' + i.split('.svg')[0],
    }));
    return icons;
}

console.log('Starting app');
app.on('ready', createWindow);
