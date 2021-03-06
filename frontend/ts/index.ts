import {
    clipboard,
    ContextMenuParams,
    DidFailLoadEvent,
    ipcRenderer,
    PageFaviconUpdatedEvent,
    remote,
    shell,
    UpdateTargetUrlEvent,
    WebContents,
    WebviewTag,
} from "electron";
import Service from "../../src/Service";
import {IconProperties, IconSet, SpecialPages} from "../../src/Meta";
import Config from "../../src/Config";

const {
    Menu,
    MenuItem,
    dialog,
    session,
} = remote;

const appInfo: {
    title?: string;
} = {};
let icons: IconProperties[] = [];

let services: (FrontService | undefined)[] = [];
let selectedServiceId: number | null = null;
let securityButton: HTMLElement | null = null,
    homeButton: HTMLElement | null = null,
    forwardButton: HTMLElement | null = null,
    backButton: HTMLElement | null = null,
    refreshButton: HTMLElement | null = null;
let addButton, settingsButton;
let specialPages: SpecialPages | null = null;
let urlPreview: HTMLElement | null = null;
let serviceSelector: HTMLElement | null = null;

// Service reordering
let lastDragPosition: HTMLElement | null = null;
let oldActiveService: number | null = null;

// Service context menu
function openServiceContextMenu(event: Event, serviceId: number) {
    event.preventDefault();
    const service = services[serviceId];
    if (!service) throw new Error('Service doesn\'t exist.');

    const menu = new Menu();
    const ready = service.view && service.viewReady, notReady = !service.view && !service.viewReady;
    menu.append(new MenuItem({
        label: 'Home', click: () => {
            service.view?.loadURL(service.url)
                .catch(console.error);
        },
        enabled: ready,
    }));
    menu.append(new MenuItem({
        label: ready ? 'Reload' : 'Load', click: () => {
            reloadService(serviceId);
        },
        enabled: ready || notReady,
    }));
    menu.append(new MenuItem({
        label: 'Close', click: () => {
            unloadService(serviceId);
        },
        enabled: ready,
    }));

    menu.append(new MenuItem({type: "separator"}));

    menu.append(new MenuItem({
        label: 'Reset zoom level', click: () => {
            if (service.view) {
                service.view.setZoomFactor(1);
                service.view.setZoomLevel(0);
            }
        },
        enabled: ready && service.view?.getZoomFactor() !== 1 && service.view?.getZoomLevel() !== 0,
    }));
    menu.append(new MenuItem({
        label: 'Zoom in', click: () => {
            if (service.view) {
                service.view.setZoomLevel(service.view.getZoomLevel() + 1);
            }
        },
        enabled: ready,
    }));
    menu.append(new MenuItem({
        label: 'Zoom out', click: () => {
            if (service.view) {
                service.view.setZoomLevel(service.view.getZoomLevel() - 1);
            }
        },
        enabled: ready,
    }));

    menu.append(new MenuItem({type: "separator"}));

    const permissionsMenu = [];
    if (ready) {
        for (const domain of Object.keys(service.permissions)) {
            const domainPermissionsMenu = [];

            const domainPermissions = service.permissions[domain];
            if (domainPermissions) {
                for (const permission of domainPermissions) {
                    domainPermissionsMenu.push({
                        label: (permission.authorized ? '✓' : '❌') + ' ' + permission.name,
                        submenu: [{
                            label: 'Toggle',
                            click: () => {
                                permission.authorized = !permission.authorized;
                                updateServicePermissions(serviceId);
                            },
                        }, {
                            label: 'Forget',
                            click: () => {
                                service.permissions[domain] = domainPermissions.filter(p => p !== permission);
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
            ipcRenderer.send('openServiceSettings', serviceId);
        },
    }));
    menu.append(new MenuItem({
        label: 'Delete', click: () => {
            dialog.showMessageBox(remote.getCurrentWindow(), {
                type: 'question',
                title: 'Confirm',
                message: 'Are you sure you want to delete this service?',
                buttons: ['Cancel', 'Confirm'],
                cancelId: 0,
            }).then(result => {
                if (result.response === 1) {
                    ipcRenderer.send('deleteService', serviceId);
                }
            }).catch(console.error);
        },
    }));
    menu.popup({window: remote.getCurrentWindow()});
}


ipcRenderer.on('data', (
    event,
    appTitle: string,
    iconSets: IconSet[],
    activeServiceId: number,
    _specialPages: SpecialPages,
    config: Config,
) => {
    // App info
    appInfo.title = appTitle;

    // Icons
    icons = [];
    for (const set of iconSets) {
        icons.push(...set);
    }

    // Special pages
    specialPages = _specialPages;

    console.log('Updating services ...');
    services = config.services;

    const nav = document.querySelector('#service-selector');
    if (nav) {
        while (nav.children.length > 0) {
            nav.removeChild(nav.children[0]);
        }
    }

    const serviceContainer = document.querySelector('#services');
    if (serviceContainer) {
        serviceContainer.querySelectorAll(":scope > webview").forEach(w => serviceContainer.removeChild(w));
    }

    for (let i = 0; i < services.length; i++) {
        createServiceNavigationElement(i);
    }

    // Init drag last position
    lastDragPosition = document.getElementById('service-last-drag-position');
    if (lastDragPosition) {
        lastDragPosition.addEventListener('dragover', () => {
            const index = services.length;
            if (draggedId !== index && draggedId !== index - 1) {
                resetDrag();
                lastDragTarget = index;
                lastDragPosition?.classList.remove('hidden');
                lastDragPosition?.classList.add('drag-target');
            }
        });
    }

    // Set active service
    if (activeServiceId < 0 || activeServiceId >= services.length) {
        activeServiceId = 0;
    }
    setActiveService(activeServiceId);

    // Url preview element
    urlPreview = document.getElementById("url-preview");
    if (urlPreview) {
        const _urlPreview = urlPreview;
        urlPreview.addEventListener('mouseover', () => {
            if (_urlPreview.classList.contains('right')) {
                _urlPreview.classList.remove('right');
            } else {
                _urlPreview.classList.add('right');
            }
        });
    }

    // History nav buttons
    const buttons: { [k: string]: HTMLElement | null } = {
        securityButton: securityButton,
        homeButton: homeButton,
        backButton: backButton,
        forwardButton: forwardButton,
        refreshButton: refreshButton,
    };
    for (const k in buttons) {
        if (config[k]) buttons[k]?.classList.remove('hidden');
        else buttons[k]?.classList.add('hidden');
    }

    // Other elements
    serviceSelector = document.getElementById('service-selector');

    // Navbar size
    document.documentElement.style.setProperty('--nav-width', config.bigNavBar ? '64px' : '48px');
});

function removeServiceFeatures(id: number): Element | null {
    // Remove nav
    const nav = document.querySelector('#service-selector');
    let oldNavButton: HTMLElement | null = null;
    let nextSibling: Element | null = null;
    if (nav) {
        oldNavButton = nav.querySelector('li:nth-of-type(' + (id + 1) + ')');
        if (oldNavButton) {
            nextSibling = oldNavButton.nextElementSibling;
            nav.removeChild(oldNavButton);
        }
    }

    // Remove webview
    const service = services[id];
    if (service) {
        const view = service.view;
        if (view) document.querySelector('#services')?.removeChild(view);
    }

    return nextSibling;
}

ipcRenderer.on('updateService', (e, id: number | null, data: Service) => {
    if (id === null) {
        console.log('Adding new service');
        services.push(data);
        createServiceNavigationElement(services.length - 1);
    } else {
        console.log('Updating existing service', id);
        const nextSibling = removeServiceFeatures(id);

        // Create new service
        services[id] = data;
        createServiceNavigationElement(id, nextSibling);
        if (selectedServiceId === id) {
            setActiveService(id);
        }
    }
});

ipcRenderer.on('reorderService', (e, serviceId: number, targetId: number) => {
    const oldServices = services;
    services = [];

    let newId = targetId;

    for (let i = 0; i < targetId; i++) {
        if (i !== serviceId) {
            services.push(oldServices[i]);
            if (i === oldActiveService) newId = services.length - 1;
        }
    }
    services.push(oldServices[serviceId]);
    for (let i = targetId; i < oldServices.length; i++) {
        if (i !== serviceId) {
            services.push(oldServices[i]);
            if (i === oldActiveService) newId = services.length - 1;
        }
    }

    if (serviceSelector) {
        serviceSelector.innerHTML = '';
    }
    for (let i = 0; i < services.length; i++) {
        const service = services[i];
        if (service) service.li = undefined;
        createServiceNavigationElement(i);
    }
    setActiveService(newId);
});

ipcRenderer.on('deleteService', (e, id: number) => {
    removeServiceFeatures(id);

    if (selectedServiceId === id) {
        setActiveService(0);
    }

    services.splice(id, 1);
});

function createServiceNavigationElement(index: number, nextNavButton?: Element | null) {
    const service = services[index];
    if (!service) throw new Error('Service doesn\'t exist.');

    const li = document.createElement('li') as NavigationElement;
    service.li = li;

    const button = document.createElement('button');
    button.dataset.serviceId = '' + index;
    button.dataset.tooltip = service.name;
    button.addEventListener('click', () => {
        const rawId = button.dataset.serviceId;
        if (rawId) {
            const id = parseInt(rawId);
            setActiveService(id);
            ipcRenderer.send('setActiveService', id);
        }
    });
    button.addEventListener('contextmenu', e => openServiceContextMenu(e, index));

    let icon: HTMLImageElement | HTMLElement;
    if (service.useFavicon && service.favicon != null) {
        icon = document.createElement('img');
        if (icon instanceof HTMLImageElement) {
            icon.src = service.favicon;
            icon.alt = service.name;
        }
    } else if (service.isImage && service.icon) {
        icon = document.createElement('img');
        if (icon instanceof HTMLImageElement) {
            icon.src = service.icon;
            icon.alt = service.name;
        }
    } else {
        icon = document.createElement('i');
        let iconProperties = icons.find(i => `${i.set}/${i.name}` === service.icon);

        // Compatibility with old services
        if (!iconProperties) iconProperties = icons.find(i => i.name === service.icon);

        if (iconProperties) {
            iconProperties.faIcon.split(' ').forEach((cl: string) => {
                icon.classList.add(cl);
            });
        } else {
            icon.classList.add('fas', 'fa-circle');
        }
    }

    button.appendChild(icon);
    li.appendChild(button);
    li.button = button;

    const nav = document.querySelector('#service-selector');
    if (nav) {
        if (nextNavButton === nav || nextNavButton === undefined) {
            nav.appendChild(li);
        } else {
            nav.insertBefore(li, nextNavButton);
        }
    }

    if (service.autoLoad) {
        loadService(index, service);
    }

    initDrag(index, li);
}

let draggedId: number;
let lastDragTarget = -1;

function initDrag(index: number, li: NavigationElement) {
    li.serviceId = index;
    li.draggable = true;
    li.addEventListener('dragstart', (event: DragEvent) => {
        draggedId = index;
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'move';
        }
        lastDragPosition?.classList.remove('hidden');
    });
    li.addEventListener('dragover', (e: DragEvent) => {
        let realIndex = index;
        const rect = li.getBoundingClientRect();

        if ((e.clientY - rect.y) / rect.height >= 0.5) {
            realIndex++;
        }

        if (draggedId === realIndex - 1) {
            realIndex--;
        }

        resetDrag();
        const el = realIndex === services.length ?
            lastDragPosition :
            services[realIndex]?.li;
        lastDragTarget = realIndex;
        lastDragPosition?.classList.remove('hidden');

        if (el) {
            el.classList.add('drag-target');

            if (draggedId === realIndex || draggedId === realIndex - 1)
                el.classList.add('drag-target-self');
        }
    });
    li.addEventListener('dragend', () => {
        reorderService(draggedId, lastDragTarget);
        resetDrag();
    });
}

function resetDrag() {
    lastDragTarget = -1;
    serviceSelector?.querySelectorAll('li').forEach(li => {
        li.classList.remove('drag-target');
        li.classList.remove('drag-target-self');
    });
    const lastDragPosition = document.getElementById('service-last-drag-position');
    lastDragPosition?.classList.remove('drag-target');
    lastDragPosition?.classList.add('hidden');
}

function reorderService(serviceId: number, targetId: number) {
    console.log('Reordering service', serviceId, targetId);
    if (targetId >= 0) {
        oldActiveService = selectedServiceId;
        setActiveService(-1);
        ipcRenderer.send('reorderService', serviceId, targetId);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    securityButton = document.getElementById('status');

    homeButton = document.getElementById('home');
    homeButton?.addEventListener('click', () => goHome());

    forwardButton = document.getElementById('forward');
    forwardButton?.addEventListener('click', () => goForward());

    backButton = document.getElementById('back');
    backButton?.addEventListener('click', () => goBack());

    refreshButton = document.getElementById('reload');
    refreshButton?.addEventListener('click', () => reload());

    addButton = document.getElementById('add-button');
    addButton?.addEventListener('click', () => ipcRenderer.send('openServiceSettings', null));

    settingsButton = document.getElementById('settings-button');
    settingsButton?.addEventListener('click', () => ipcRenderer.send('openSettings', null));
});

function setActiveService(serviceId: number) {
    const currentService = services[serviceId];
    process.nextTick(() => {
        if (currentService) {
            loadService(serviceId, currentService);
        }

        // Hide previous service
        if (typeof selectedServiceId === 'number') {
            const selectedService = services[selectedServiceId];
            if (selectedService && selectedService.view) {
                selectedService.view.classList.remove('active');
            }
        }

        // Show service
        currentService?.view?.classList.add('active');

        // Save active service ID
        selectedServiceId = serviceId;

        // Refresh navigation
        updateNavigation();
    });
}

function loadService(serviceId: number, service: FrontService) {
    // Load service if not loaded yet
    if (!service.view && !service.viewReady) {
        console.log('Loading service', serviceId);

        document.querySelector('#services > .loader')?.classList.remove('hidden');
        const view = service.view = document.createElement('webview');
        updateNavigation(); // Start loading animation
        view.setAttribute('enableRemoteModule', 'false');
        view.setAttribute('partition', 'persist:service_' + service.partition);
        view.setAttribute('autosize', 'true');
        if (specialPages) view.setAttribute('src', specialPages.empty);

        // Error handling
        view.addEventListener('did-fail-load', (e: DidFailLoadEvent) => {
            if (e.errorCode <= -100 && e.errorCode > -200) {
                if (specialPages) view.setAttribute('src', specialPages.connectionError);
            } else if (e.errorCode === -6) {
                if (specialPages) view.setAttribute('src', specialPages.fileNotFound);
            } else if (e.errorCode !== -3) {
                console.error('Unhandled error:', e);
            }
        });

        // Append element to DOM
        document.querySelector('#services')?.appendChild(view);

        // Load chain
        let listener: () => void;
        view.addEventListener('dom-ready', listener = () => {
            view.removeEventListener('dom-ready', listener);

            view.addEventListener('dom-ready', listener = () => {
                if (service.customCSS) {
                    view.insertCSS(service.customCSS)
                        .catch(console.error);
                }

                document.querySelector('#services > .loader')?.classList.add('hidden');
                service.li?.classList.add('loaded');
                service.viewReady = true;

                updateNavigation();

                if (selectedServiceId === null) {
                    setActiveService(serviceId);
                }
            });

            const webContents = remote.webContents.fromId(view.getWebContentsId());

            // Set custom user agent
            if (typeof service.customUserAgent === 'string') {
                webContents.setUserAgent(service.customUserAgent);
            }

            // Set context menu
            setContextMenu(webContents);

            // Set permission request handler
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

            const serviceSession = session.fromPartition(view.partition);
            serviceSession.setPermissionRequestHandler((webContents, permissionName, callback, details) => {
                const domain = getUrlDomain(details.requestingUrl);
                const domainPermissions = getDomainPermissions(domain);

                const existingPermissions = domainPermissions.filter(p => p.name === permissionName);
                if (existingPermissions.length > 0) {
                    callback(existingPermissions[0].authorized);
                    return;
                }

                dialog.showMessageBox(remote.getCurrentWindow(), {
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
                    updateServicePermissions(serviceId);

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

            view.setAttribute('src', service.url);
        });

        // Load favicon
        view.addEventListener('page-favicon-updated', (event: PageFaviconUpdatedEvent) => {
            console.debug('Loaded favicons for', service.name, event.favicons);
            if (event.favicons.length > 0 && service.favicon !== event.favicons[0]) {
                ipcRenderer.send('setServiceFavicon', serviceId, event.favicons[0]);
                if (service.useFavicon) {
                    const img = document.createElement('img');
                    img.src = event.favicons[0];
                    img.alt = service.name;
                    img.onload = () => {
                        if (service.li) {
                            service.li.button.innerHTML = '';
                            service.li.button.appendChild(img);
                        }
                    };
                }
            }
        });

        // Display target urls
        view.addEventListener('update-target-url', (event: UpdateTargetUrlEvent) => {
            if (event.url.length === 0) {
                urlPreview?.classList.add('invisible');
            } else {
                urlPreview?.classList.remove('invisible');
                if (urlPreview) {
                    urlPreview.innerHTML = event.url;
                }
            }
        });
    }
}

function unloadService(serviceId: number) {
    const service = services[serviceId];
    if (!service) throw new Error('Service doesn\'t exist.');

    if (service.view && service.viewReady) {
        service.view.remove();
        service.view = undefined;
        service.li?.classList.remove('loaded');
        service.viewReady = false;

        if (selectedServiceId === serviceId) {
            selectedServiceId = null;

            for (let i = 0; i < services.length; i++) {
                const otherService = services[i];
                if (otherService && otherService.view && otherService.viewReady) {
                    setActiveService(i);
                    break;
                }
            }

            // false positive:
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (selectedServiceId === null) {
                updateNavigation();
            }
        }
    }
}

function reloadService(serviceId: number) {
    const service = services[serviceId];
    if (!service) throw new Error('Service doesn\'t exist.');

    if (service.view && service.viewReady) {
        console.log('Reloading service', serviceId);
        document.querySelector('#services > .loader')?.classList.remove('hidden');
        service.view.reload();
    } else if (!service.view && !service.viewReady) {
        loadService(serviceId, service);
    }
}

function updateServicePermissions(serviceId: number) {
    const service = services[serviceId];
    if (!service) throw new Error('Service doesn\'t exist.');

    ipcRenderer.send('updateServicePermissions', serviceId, service.permissions);
}

function updateNavigation() {
    console.debug('Updating navigation');
    // Update active list element
    for (let i = 0; i < services.length; i++) {
        const service = services[i];
        if (!service) continue;

        if (!service.li) continue;

        // Active?
        if (selectedServiceId === i) service.li.classList.add('active');
        else service.li.classList.remove('active');

        // Loading?
        if (service.view && !service.viewReady) service.li.classList.add('loading');
        else service.li.classList.remove('loading');

        // Loaded?
        if (service.viewReady) service.li.classList.add('loaded');
        else service.li.classList.remove('loaded');
    }

    if (selectedServiceId !== null && services[selectedServiceId]?.viewReady) {
        console.debug('Updating navigation buttons because view is ready');
        // Update history navigation
        const view = services[selectedServiceId]?.view;

        homeButton?.classList.remove('disabled');

        if (view && view.canGoForward()) forwardButton?.classList.remove('disabled');
        else forwardButton?.classList.add('disabled');

        if (view && view.canGoBack()) backButton?.classList.remove('disabled');
        else backButton?.classList.add('disabled');

        refreshButton?.classList.remove('disabled');

        updateStatusButton();
    }

    updateWindowTitle();
}

function updateStatusButton() {
    if (typeof selectedServiceId !== 'number') return;

    const protocol = services[selectedServiceId]?.view?.getURL().split('://')[0] || 'unknown';
    securityButton?.childNodes.forEach(el => {
        if (el instanceof HTMLElement) {
            if (el.classList.contains(protocol)) el.classList.add('active');
            else el.classList.remove('active');
        }
    });
}

function updateWindowTitle() {
    if (selectedServiceId === null) {
        ipcRenderer.send('updateWindowTitle', null);
    } else {
        const service = services[selectedServiceId];
        if (service?.viewReady && service.view) {
            ipcRenderer.send('updateWindowTitle', selectedServiceId, remote.webContents.fromId(service.view.getWebContentsId()).getTitle());
        }
    }
}

function goHome() {
    if (selectedServiceId === null) return;

    const service = services[selectedServiceId];
    if (!service) throw new Error('Service doesn\'t exist.');

    service.view?.loadURL(service.url)
        .catch(console.error);
}

function goForward() {
    if (selectedServiceId === null) return;

    const view = services[selectedServiceId]?.view;
    if (view) remote.webContents.fromId(view.getWebContentsId()).goForward();
}

function goBack() {
    if (selectedServiceId === null) return;

    const view = services[selectedServiceId]?.view;
    if (view) remote.webContents.fromId(view.getWebContentsId()).goBack();
}

function reload() {
    if (selectedServiceId === null) return;

    reloadService(selectedServiceId);
}

function setContextMenu(webContents: WebContents) {
    webContents.on('context-menu', (event, props: ContextMenuParams) => {
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
                    webContents.copyImageAt(props.x, props.y);
                },
            }));

            menu.append(new MenuItem({
                label: 'Save image as',
                click: () => {
                    webContents.downloadURL(props.srcURL);
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
                webContents.inspectElement(props.x, props.y);
            },
        }));


        menu.popup({
            window: remote.getCurrentWindow(),
        });
    });
}

ipcRenderer.on('fullscreenchange', (e, fullscreen: boolean) => {
    if (fullscreen) document.body.classList.add('fullscreen');
    else document.body.classList.remove('fullscreen');
});

type FrontService = Service & {
    view?: WebviewTag;
    viewReady?: boolean;
    li?: NavigationElement;
};

type NavigationElement = HTMLLIElement & {
    serviceId: number;
    button: HTMLButtonElement;
};
