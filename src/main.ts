import fs from "fs";
import path from "path";
import SingleInstance from "single-instance";
import {app, BrowserWindow, dialog, ipcMain, Menu, shell, Tray} from "electron";

import Meta from "./Meta";
import Config from "./Config";
import Service from "./Service";
import Updater from "./Updater";
import Event = Electron.Event;

const resourcesDir = path.resolve(__dirname, '../resources');
const iconPath = path.resolve(resourcesDir, 'logo.png');

const config = new Config();
const updater = new Updater();

const devMode = Meta.isDevMode();

// Load icons
const brandIcons = listIcons('brands');
const solidIcons = listIcons('solid');

let selectedService = 0;

let tray: Tray;
let window: BrowserWindow | null;
let serviceSettingsWindow: BrowserWindow | null, settingsWindow: BrowserWindow | null;

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

async function createWindow() {
    // Check for updates
    updater.checkForUpdates((available, updateInfo) => {
        if (available && updateInfo.version !== config.updateCheckSkip) {
            dialog.showMessageBox(window!, {
                message: `Version ${updateInfo.version} of tabs is available. Do you wish to download this update?`,
                buttons: [
                    'Cancel',
                    'Download',
                ],
                checkboxChecked: false,
                checkboxLabel: `Don't remind me for this version`,
                cancelId: 0,
                defaultId: 1,
                type: 'question'
            }).then(e => {
                if (e.checkboxChecked) {
                    console.log('Skipping update check for version', updateInfo.version);
                    config.updateCheckSkip = updateInfo.version;
                    config.save();
                }
                if (e.response === 1) {
                    return shell.openExternal(`https://github.com/ArisuOngaku/tabs/releases/download/v${updateInfo.version}/${updateInfo.path}`);
                }
            }).catch(console.error);
        }
    });

    // System tray
    console.log('Loading system Tray');
    tray = new Tray(iconPath);
    tray.setToolTip('Tabs');
    tray.setContextMenu(Menu.buildFromTemplate([
        {label: 'Tabs', enabled: false},
        {label: 'Open Tabs', click: () => window!.show()},
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
                if (url.startsWith('https://')) {
                    shell.openExternal(url);
                }
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
                parent: window!,
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
            let syncListener: () => void;
            ipcMain.on('sync-settings', syncListener = () => {
                serviceSettingsWindow!.webContents.send('syncIcons', brandIcons, solidIcons);
                serviceSettingsWindow!.webContents.send('loadService', serviceId, config.services[serviceId]);
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
            id = config.services.indexOf(newService);
        }
        config.save();

        window!.webContents.send('updateService', id, newService);
    });

    ipcMain.on('deleteService', (e, id) => {
        console.log('Deleting service', id);
        delete config.services[id];
        config.save();

        window!.webContents.send('deleteService', id);
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

    ipcMain.on('updateServicePermissions', (e, serviceId, permissions) => {
        config.services[serviceId].permissions = permissions;
        config.save();
    });

    ipcMain.on('updateWindowTitle', (event, serviceId, viewTitle) => {
        if (serviceId === null) {
            window!.setTitle(Meta.title);
        } else {
            const service = config.services[serviceId];
            window!.setTitle(Meta.getTitleForService(service, viewTitle));
        }
    });

    // Open add service window
    ipcMain.on('openSettings', (e) => {
        if (!settingsWindow) {
            console.log('Opening settings');
            settingsWindow = new BrowserWindow({
                webPreferences: {
                    nodeIntegration: true,
                    enableRemoteModule: true,
                    webviewTag: true,
                },
                parent: window!,
                modal: true,
                autoHideMenuBar: true,
                height: 850,
            });
            settingsWindow.on('close', () => {
                settingsWindow = null;
            });
            if (devMode) {
                settingsWindow.webContents.openDevTools({
                    mode: 'right'
                });
            }
            let syncListener: () => void;
            ipcMain.on('syncSettings', syncListener = () => {
                settingsWindow!.webContents.send('current-version', updater.getCurrentVersion());
                settingsWindow!.webContents.send('config', config);
            });

            let checkForUpdatesListener: () => void;
            ipcMain.on('checkForUpdates', checkForUpdatesListener = () => {
                updater.checkForUpdates((available, version) => {
                    settingsWindow!.webContents.send('updateStatus', available, version);
                });
            });

            let saveConfigListener: (e: Event, data: any) => void;
            ipcMain.on('save-config', saveConfigListener = (e: Event, data: any) => {
                config.update(data);
                config.save();
                sendData();
            });

            settingsWindow.on('close', () => {
                ipcMain.removeListener('syncSettings', syncListener);
                ipcMain.removeListener('checkForUpdates', checkForUpdatesListener);
                ipcMain.removeListener('save-config', saveConfigListener);
            });
            settingsWindow.loadFile(path.resolve(resourcesDir, 'settings.html'))
                .catch(console.error);
        }
    });

    console.log('> App started');
}

function sendData() {
    console.log('Syncing data');
    window!.webContents.send('data', Meta.title, brandIcons, solidIcons, selectedService, path.resolve(resourcesDir, 'empty.html'), config);
}

function setActiveService(index: number) {
    console.log('Selected service is now', index);
    selectedService = index;
}

function listIcons(set: string) {
    console.log('Loading icon set', set);
    const directory = path.resolve(resourcesDir, 'icons/' + set);
    const icons: { name: string; faIcon: string }[] = [];
    const dir = set === 'brands' ? 'fab' : 'fas';
    fs.readdirSync(directory).forEach(i => icons.push({
        name: i.split('.svg')[0],
        faIcon: dir + ' fa-' + i.split('.svg')[0],
    }));
    return icons;
}


// Check if application is already running
const lock = new SingleInstance('tabs-app');
lock.lock().then(() => {
    console.log('Starting app');
    app.on('ready', () => {
        createWindow().catch(console.error);
    });
}).catch(err => {
    console.error(err);
    process.exit(0);
});
