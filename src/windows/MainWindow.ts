import path from "path";
import {
    clipboard,
    ContextMenuParams,
    dialog,
    ipcMain,
    Menu,
    MenuItem, session, shell,
    webContents,
} from "electron";
import ServiceSettingsWindow from "./ServiceSettingsWindow";
import SettingsWindow from "./SettingsWindow";
import Application from "../Application";
import Meta, {SpecialPages} from "../Meta";
import Window from "../Window";

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
                webviewTag: true,
                contextIsolation: false,
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

        // Update window title
        ipcMain.on('update-window-title', (event, serviceId: number | null, webContentsId?: number) => {
            if (serviceId === null) {
                window.setTitle(Meta.title);
            } else if (webContentsId) {
                const service = this.config.services[serviceId];
                const serviceWebContents = webContents.fromId(webContentsId);
                window.setTitle(Meta.getTitleForService(service, serviceWebContents.getTitle()));
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

        // Context menus
        ipcMain.on('open-service-navigation-context-menu', (
            event,
            serviceId: number,
            ready: boolean,
            notReady: boolean,
            canResetZoom: boolean,
        ) => {
            this.openServiceNavigationContextMenu(serviceId, ready, notReady, canResetZoom);
        });
        ipcMain.on('open-service-content-context-menu', (
            event,
            webContentsId: number,
        ) => {
            this.openServiceContentContextMenu(webContentsId);
        });

        // User agent
        ipcMain.on('set-web-contents-user-agent', (event, webContentsId: number, userAgent: string) => {
            webContents.fromId(webContentsId).setUserAgent(userAgent);
        });

        // Permission management
        ipcMain.on('set-partition-permissions', (
            event,
            serviceId: number,
            partition: string,
        ) => {
            this.setPartitionPermissions(serviceId, partition);
        });

        // Navigation
        ipcMain.on('go-forward', (event, webContentsId: number) => {
            webContents.fromId(webContentsId).goForward();
        });
        ipcMain.on('go-back', (event, webContentsId: number) => {
            webContents.fromId(webContentsId).goBack();
        });

        // Create new service
        ipcMain.on('create-new-service', () => {
            this.openServiceSettings(null);
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

    private openServiceSettings(serviceId: number | null): void {
        console.log('o', serviceId, !!this.serviceSettingsWindow);
        if (!this.serviceSettingsWindow) {
            console.log('Opening service settings', serviceId);
            this.serviceSettingsWindow = new ServiceSettingsWindow(this.application, this, serviceId);
            this.serviceSettingsWindow.setup();
            this.serviceSettingsWindow.onClose(() => {
                this.serviceSettingsWindow = undefined;
            });
        }
    }

    private deleteService(serviceId: number): void {
        console.log('Deleting service', serviceId);
        this.config.services.splice(serviceId, 1);
        this.config.save();

        this.getWindow().webContents.send('deleteService', serviceId);
    }

    private openServiceNavigationContextMenu(
        serviceId: number,
        ready: boolean,
        notReady: boolean,
        canResetZoom: boolean,
    ): void {
        const ipc = this.getWindow().webContents;
        const permissions = this.config.services[serviceId].permissions;

        const menu = new Menu();
        menu.append(new MenuItem({
            label: 'Home', click: () => {
                ipc.send('load-service-home', serviceId);
            },
            enabled: ready,
        }));
        menu.append(new MenuItem({
            label: ready ? 'Reload' : 'Load', click: () => {
                ipc.send('reload-service', serviceId);
            },
            enabled: ready || notReady,
        }));
        menu.append(new MenuItem({
            label: 'Close', click: () => {
                ipc.send('unload-service', serviceId);
            },
            enabled: ready,
        }));

        menu.append(new MenuItem({type: "separator"}));

        menu.append(new MenuItem({
            label: 'Reset zoom level', click: () => {
                ipc.send('reset-service-zoom-level', serviceId);
            },
            enabled: ready && canResetZoom,
        }));
        menu.append(new MenuItem({
            label: 'Zoom in', click: () => {
                ipc.send('zoom-in-service', serviceId);
            },
            enabled: ready,
        }));
        menu.append(new MenuItem({
            label: 'Zoom out', click: () => {
                ipc.send('zoom-out-service', serviceId);
            },
            enabled: ready,
        }));

        menu.append(new MenuItem({type: "separator"}));

        const permissionsMenu = [];
        if (ready) {
            for (const domain of Object.keys(permissions)) {
                const domainPermissionsMenu = [];

                const domainPermissions = permissions[domain];
                if (domainPermissions) {
                    for (const permission of domainPermissions) {
                        domainPermissionsMenu.push({
                            label: (permission.authorized ? '✓' : '❌') + ' ' + permission.name,
                            submenu: [{
                                label: 'Toggle',
                                click: () => {
                                    permission.authorized = !permission.authorized;
                                    this.config.save();
                                },
                            }, {
                                label: 'Forget',
                                click: () => {
                                    permissions[domain] = domainPermissions.filter(p => p !== permission);
                                },
                            }],
                        });
                    }
                }

                if (domainPermissionsMenu.length > 0) {
                    permissionsMenu.push({
                        label: domain,
                        submenu: domainPermissionsMenu,
                    });
                }
            }
        }
        menu.append(new MenuItem({
            label: 'Permissions',
            enabled: ready,
            submenu: permissionsMenu,
        }));

        menu.append(new MenuItem({type: "separator"}));

        menu.append(new MenuItem({
            label: 'Edit', click: () => {
                this.openServiceSettings(serviceId);
            },
        }));
        menu.append(new MenuItem({
            label: 'Delete', click: () => {
                dialog.showMessageBox(this.getWindow(), {
                    type: 'question',
                    title: 'Confirm',
                    message: 'Are you sure you want to delete this service?',
                    buttons: ['Cancel', 'Confirm'],
                    cancelId: 0,
                }).then(result => {
                    if (result.response === 1) {
                        this.deleteService(serviceId);
                    }
                }).catch(console.error);
            },
        }));
        menu.popup({window: this.getWindow()});
    }

    private openServiceContentContextMenu(
        webContentsId: number,
    ): void {
        const serviceWebContents = webContents.fromId(webContentsId);

        serviceWebContents.on('context-menu', (event, props: ContextMenuParams) => {
            const menu = new Menu();
            const {editFlags} = props;

            // linkURL
            if (props.linkURL.length > 0) {
                if (menu.items.length > 0) {
                    menu.append(new MenuItem({type: 'separator'}));
                }

                menu.append(new MenuItem({
                    label: 'Copy link URL',
                    click: () => {
                        clipboard.writeText(props.linkURL);
                    },
                }));
                menu.append(new MenuItem({
                    label: 'Open URL in default browser',
                    click: () => {
                        if (props.linkURL.startsWith('https://')) {
                            shell.openExternal(props.linkURL)
                                .catch(console.error);
                        }
                    },
                }));
            }

            // Image
            if (props.hasImageContents) {
                if (menu.items.length > 0) {
                    menu.append(new MenuItem({type: 'separator'}));
                }

                menu.append(new MenuItem({
                    label: 'Copy image',
                    click: () => {
                        serviceWebContents.copyImageAt(props.x, props.y);
                    },
                }));

                menu.append(new MenuItem({
                    label: 'Save image as',
                    click: () => {
                        serviceWebContents.downloadURL(props.srcURL);
                    },
                }));
            }

            // Text clipboard
            if (editFlags.canUndo || editFlags.canRedo || editFlags.canCut || editFlags.canCopy || editFlags.canPaste ||
                editFlags.canDelete) {
                if (editFlags.canUndo || editFlags.canRedo) {
                    if (menu.items.length > 0) {
                        menu.append(new MenuItem({type: 'separator'}));
                    }

                    if (editFlags.canUndo) {
                        menu.append(new MenuItem({
                            label: 'Undo',
                            role: 'undo',
                        }));
                    }
                    if (editFlags.canRedo) {
                        menu.append(new MenuItem({
                            label: 'Redo',
                            role: 'redo',
                        }));
                    }
                }

                if (menu.items.length > 0) {
                    menu.append(new MenuItem({type: 'separator'}));
                }

                menu.append(new MenuItem({
                    label: 'Cut',
                    role: 'cut',
                    enabled: editFlags.canCut,
                }));
                menu.append(new MenuItem({
                    label: 'Copy',
                    role: 'copy',
                    enabled: editFlags.canCopy,
                }));
                menu.append(new MenuItem({
                    label: 'Paste',
                    role: 'paste',
                    enabled: editFlags.canPaste,
                }));
                menu.append(new MenuItem({
                    label: 'Delete',
                    role: 'delete',
                    enabled: editFlags.canDelete,
                }));
            }

            if (editFlags.canSelectAll) {
                if (menu.items.length > 0) {
                    menu.append(new MenuItem({type: 'separator'}));
                }

                menu.append(new MenuItem({
                    label: 'Select all',
                    role: 'selectAll',
                }));
            }

            // Inspect element
            if (menu.items.length > 0) {
                menu.append(new MenuItem({type: 'separator'}));
            }

            menu.append(new MenuItem({
                label: 'Inspect element',
                click: () => {
                    serviceWebContents.inspectElement(props.x, props.y);
                },
            }));


            menu.popup({
                window: this.getWindow(),
            });
        });
    }

    private setPartitionPermissions(
        serviceId: number,
        partition: string,
    ): void {
        const service = this.config.services[serviceId];

        function getUrlDomain(url: string) {
            const matches = url.match(/^https?:\/\/((.+?)\/|(.+))/i);
            if (matches !== null) {
                let domain = matches[1];
                if (domain.endsWith('/')) domain = domain.substr(0, domain.length - 1);
                return domain;
            }

            return '';
        }

        function getDomainPermissions(domain: string) {
            let domainPermissions = service.permissions[domain];
            if (!domainPermissions) domainPermissions = service.permissions[domain] = [];
            return domainPermissions;
        }

        const serviceSession = session.fromPartition(partition);
        serviceSession.setPermissionRequestHandler((webContents, permissionName, callback, details) => {
            const domain = getUrlDomain(details.requestingUrl);
            const domainPermissions = getDomainPermissions(domain);

            const existingPermissions = domainPermissions.filter(p => p.name === permissionName);
            if (existingPermissions.length > 0) {
                callback(existingPermissions[0].authorized);
                return;
            }

            dialog.showMessageBox(this.getWindow(), {
                type: 'question',
                title: 'Grant ' + permissionName + ' permission',
                message: 'Do you wish to grant the ' + permissionName + ' permission to ' + domain + '?',
                buttons: ['Deny', 'Authorize'],
                cancelId: 0,
            }).then(result => {
                const authorized = result.response === 1;

                domainPermissions.push({
                    name: permissionName,
                    authorized: authorized,
                });
                this.config.save();

                console.log(authorized ? 'Granted' : 'Denied', permissionName, 'for domain', domain);
                callback(authorized);
            }).catch(console.error);
        });
        serviceSession.setPermissionCheckHandler((webContents1, permissionName, requestingOrigin, details) => {
            console.log('Permission check', permissionName, requestingOrigin, details);
            const domain = getUrlDomain(details.requestingUrl);
            const domainPermissions = getDomainPermissions(domain);

            const existingPermissions = domainPermissions.filter(p => p.name === permissionName);
            return existingPermissions.length > 0 && existingPermissions[0].authorized;
        });
    }
}
