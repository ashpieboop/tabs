import path from "path";
import {ipcMain} from "electron";
import ServiceSettingsWindow from "./ServiceSettingsWindow";
import SettingsWindow from "./SettingsWindow";
import Application from "../Application";
import Meta, {SpecialPages} from "../Meta";
import Window from "../Window";
import {ServicePermissions} from "../Service";

export default class MainWindow extends Window {
    private activeServiceId: number = 0;
    private serviceSettingsWindow?: ServiceSettingsWindow;
    private settingsWindow?: SettingsWindow;

    public constructor(application: Application) {
        super(application);
    }

    public setup(): void {
        super.setup({
            webPreferences: {
                nodeIntegration: true,
                enableRemoteModule: true,
                webviewTag: true,
            },
            autoHideMenuBar: true,
            icon: Meta.ICON_PATH,
            title: Meta.title,
            show: !this.application.getConfig().startMinimized,
        });

        const window = this.getWindow();

        if (!this.application.getConfig().startMinimized) {
            window.maximize();
        }

        if (this.application.isDevMode()) {
            window.webContents.openDevTools({
                mode: 'right',
            });
        }

        // Sync data
        window.webContents.on('dom-ready', () => {
            this.syncData();
        });

        // Load active service
        this.onIpc('setActiveService', (event, index: number) => {
            this.setActiveService(index);
        });

        // Set a service's favicon
        this.onIpc('setServiceFavicon', (event, index: number, favicon?: string) => {
            console.log('Setting service', index, 'favicon', favicon);
            this.config.services[index].favicon = favicon;
            this.config.save();
        });

        // Reorder services
        this.onIpc('reorderService', (event, serviceId: number, targetId: number) => {
            console.log('Reordering services', serviceId, targetId);

            const oldServices = this.config.services;
            this.config.services = [];

            for (let i = 0; i < targetId; i++) {
                if (i !== serviceId) {
                    this.config.services.push(oldServices[i]);
                }
            }
            this.config.services.push(oldServices[serviceId]);
            for (let i = targetId; i < oldServices.length; i++) {
                if (i !== serviceId) {
                    this.config.services.push(oldServices[i]);
                }
            }

            event.reply('reorderService', serviceId, targetId);
            this.config.save();
        });

        // Delete service
        this.onIpc('deleteService', (e, id: number) => {
            console.log('Deleting service', id);
            this.config.services.splice(id, 1);
            this.config.save();

            window.webContents.send('deleteService', id);
        });

        // Update service permissions
        ipcMain.on('updateServicePermissions', (e, serviceId: number, permissions: ServicePermissions) => {
            this.config.services[serviceId].permissions = permissions;
            this.config.save();
        });

        // Update window title
        ipcMain.on('updateWindowTitle', (event, serviceId: number | null, viewTitle?: string) => {
            if (serviceId === null) {
                window.setTitle(Meta.title);
            } else if (viewTitle) {
                const service = this.config.services[serviceId];
                window.setTitle(Meta.getTitleForService(service, viewTitle));
            }
        });

        // Open service settings window
        ipcMain.on('openServiceSettings', (e, serviceId: number | null) => {
            if (!this.serviceSettingsWindow) {
                console.log('Opening service settings', serviceId);
                this.serviceSettingsWindow = new ServiceSettingsWindow(this.application, this, serviceId);
                this.serviceSettingsWindow.setup();
                this.serviceSettingsWindow.onClose(() => {
                    this.serviceSettingsWindow = undefined;
                });
            }
        });

        // Open settings window
        ipcMain.on('openSettings', () => {
            if (!this.settingsWindow) {
                console.log('Opening settings');
                this.settingsWindow = new SettingsWindow(this.application, this);
                this.settingsWindow.setup();
                this.settingsWindow.onClose(() => {
                    this.settingsWindow = undefined;
                });
            }
        });

        window.on('enter-full-screen', () => {
            window.webContents.send('fullscreenchange', true);
        });
        window.on('leave-full-screen', () => {
            window.webContents.send('fullscreenchange', false);
        });

        // Load navigation view
        window.loadFile(path.resolve(Meta.RESOURCES_PATH, 'index.html'))
            .catch(console.error);
    }

    public syncData(): void {
        this.getWindow().webContents.send('data',
            Meta.title,
            Meta.ICON_SETS,
            this.activeServiceId,
            <SpecialPages>{
                empty: path.resolve(Meta.RESOURCES_PATH, 'empty.html'),
                connectionError: path.resolve(Meta.RESOURCES_PATH, 'connection_error.html'),
                fileNotFound: path.resolve(Meta.RESOURCES_PATH, 'file_not_found_error.html'),
            },
            this.config,
        );
    }

    private setActiveService(index: number) {
        console.log('Set active service', index);
        this.activeServiceId = index;
    }
}
