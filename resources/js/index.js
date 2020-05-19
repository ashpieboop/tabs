const {
    remote,
    ipcRenderer,
    clipboard,
    shell,
} = require('electron');
const {
    Menu,
    MenuItem,
    dialog,
    session,
} = remote;

const appInfo = {};
const icons = [];

let services = [];
let selectedService = null;
let statusButton, homeButton, forwardButton, backButton, reloadButton;
let addButton;
let emptyPage;
let urlPreview;

let lastDragPosition;
let oldActiveService; // For service reordering

// Service context menu
function openServiceContextMenu(event, serviceId) {
    event.preventDefault();
    const service = services[serviceId];

    const menu = new Menu();
    const ready = service.view && service.viewReady, notReady = !service.view && !service.viewReady;
    menu.append(new MenuItem({
        label: 'Home', click: () => {
            service.view.loadURL(service.url)
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

    let permissionsMenu = [];
    if (ready) {
        for (const domain in service.permissions) {
            if (service.permissions.hasOwnProperty(domain)) {
                const domainPermissionsMenu = [];

                const domainPermissions = service.permissions[domain];
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

                if (domainPermissionsMenu.length > 0) {
                    permissionsMenu.push({
                        label: domain,
                        submenu: domainPermissionsMenu,
                    });
                }
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
        }
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
        }
    }));
    menu.popup({window: remote.getCurrentWindow()});
}


ipcRenderer.on('data', (event, appData, brandIcons, solidIcons, actualServices, actualSelectedService, emptyUrl) => {
    // App info
    appInfo.title = appData.title;

    // Icons
    for (const icon of brandIcons) {
        icons.push(icon);
    }
    for (const icon of solidIcons) {
        icons.push(icon);
    }

    console.log('Updating services ...');
    services = actualServices;

    const nav = document.querySelector('#service-selector');
    while (nav.children.length > 0) {
        nav.removeChild(nav.children[0]);
    }

    const serviceContainer = document.querySelector('#services');
    serviceContainer.querySelectorAll(":scope > webview").forEach(w => serviceContainer.removeChild(w));

    for (let i = 0; i < services.length; i++) {
        createService(i);
    }

    // Init drag last position
    lastDragPosition = document.getElementById('service-last-drag-position');
    lastDragPosition.addEventListener('dragover', () => {
        const index = services.length;
        if (draggedId !== index && draggedId !== index - 1) {
            resetDrag();
            lastDragTarget = dragTargetId = index;
            lastDragPosition.classList.remove('hidden');
            lastDragPosition.classList.add('drag-target');
        }
    });

    // Set active service
    if (actualSelectedService < 0 || actualSelectedService >= services.length) {
        actualSelectedService = 0;
    }
    setActiveService(actualSelectedService);

    // Empty
    emptyPage = emptyUrl;

    // Url preview element
    urlPreview = document.getElementById("url-preview");
    urlPreview.addEventListener('mouseover', () => {
        if (urlPreview.classList.contains('right')) {
            urlPreview.classList.remove('right');
        } else {
            urlPreview.classList.add('right');
        }
    });
});

function removeServiceFeatures(id) {
    const nav = document.querySelector('#service-selector');

    // Remove nav
    const oldNavButton = nav.querySelector('li:nth-of-type(' + (id + 1) + ')');
    if (oldNavButton) {
        nav.removeChild(oldNavButton);
    }

    // Remove webview
    if (services[id] && services[id].view) {
        const serviceContainer = document.querySelector('#services');
        serviceContainer.removeChild(services[id].view);
    }

    return oldNavButton;
}

ipcRenderer.on('updateService', (e, id, data) => {
    if (id === null) {
        services.push(data);
        createService(services.length - 1);
    } else {
        const oldNavButton = removeServiceFeatures(id);

        // Create new service
        services[id] = data;
        createService(id, oldNavButton ? oldNavButton.nextSibling : null);
        if (parseInt(selectedService) === id) {
            setActiveService(id);
        }
    }
});

ipcRenderer.on('reorderService', (e, serviceId, targetId) => {
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

    document.getElementById('service-selector').innerHTML = '';
    for (let i = 0; i < services.length; i++) {
        services[i].li = undefined;
        createService(i);
    }
    setActiveService(newId);
});

ipcRenderer.on('deleteService', (e, id) => {
    removeServiceFeatures(id);

    if (parseInt(selectedService) === id) {
        setActiveService(0);
    }

    delete services[id];
    services = services.filter(s => s !== null);
});

function createService(index, nextNavButton) {
    let service = services[index];
    let li = document.createElement('li');
    service.li = li;

    let button = document.createElement('button');
    button.dataset.serviceId = '' + index;
    button.dataset.tooltip = service.name;
    button.addEventListener('click', () => {
        setActiveService(button.dataset.serviceId);
        ipcRenderer.send('setActiveService', button.dataset.serviceId);
    });
    button.addEventListener('contextmenu', e => openServiceContextMenu(e, index));

    let icon;
    if (service.useFavicon && service.favicon != null) {
        icon = document.createElement('img');
        icon.src = service.favicon;
        icon.alt = service.name;
    } else if (service.isImage) {
        icon = document.createElement('img');
        icon.src = service.icon;
        icon.alt = service.name;
    } else {
        icon = document.createElement('i');
        const iconProperties = icons.find(i => i.name === service.icon);
        if (iconProperties) {
            iconProperties.faIcon.split(' ').forEach(cl => {
                icon.classList.add(cl);
            });
        }
    }

    button.appendChild(icon);
    li.appendChild(button);
    li.button = button;

    const nav = document.querySelector('#service-selector');
    if (nextNavButton === nav || nextNavButton === undefined) {
        nav.appendChild(li);
    } else {
        nav.insertBefore(li, nextNavButton);
    }

    if (service.autoLoad) {
        loadService(index, service);
    }

    initDrag(index, li);
}

let draggedId;
let lastDragTarget = -1;
let dragTargetId = -1;
let dragTargetCount = 0;

function initDrag(index, li) {
    li.serviceId = index;
    li.draggable = true;
    li.addEventListener('dragstart', (event) => {
        draggedId = index;
        event.dataTransfer.dropEffect = 'move';
        document.getElementById('service-last-drag-position').classList.remove('hidden');
    });
    li.addEventListener('dragover', (e) => {
        let realIndex = index;
        let rect = li.getBoundingClientRect();

        if ((e.clientY - rect.y) / rect.height >= 0.5) {
            realIndex++;
        }

        if (draggedId === realIndex - 1) {
            realIndex--;
        }

        resetDrag();
        let el = realIndex === services.length ? lastDragPosition : services[realIndex].li;
        lastDragTarget = dragTargetId = realIndex;
        lastDragPosition.classList.remove('hidden');
        el.classList.add('drag-target');

        if (draggedId === realIndex || draggedId === realIndex - 1) el.classList.add('drag-target-self');
    });
    li.addEventListener('dragend', () => {
        reorderService(draggedId, lastDragTarget);
        resetDrag();
    });
}

function resetDrag() {
    lastDragTarget = -1;
    dragTargetId = -1;
    dragTargetCount = 0;
    document.getElementById('service-selector').querySelectorAll('li').forEach(li => {
        li.classList.remove('drag-target');
        li.classList.remove('drag-target-self');
    });
    const lastDragPosition = document.getElementById('service-last-drag-position');
    lastDragPosition.classList.remove('drag-target');
    lastDragPosition.classList.add('hidden');
}

function reorderService(serviceId, targetId) {
    console.log('Reordering service', serviceId, targetId);
    if (targetId >= 0) {
        oldActiveService = selectedService;
        setActiveService(null);
        ipcRenderer.send('reorderService', serviceId, targetId);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    statusButton = document.getElementById('status');

    homeButton = document.getElementById('home');
    homeButton.addEventListener('click', () => goHome());

    forwardButton = document.getElementById('forward');
    forwardButton.addEventListener('click', () => goForward());

    backButton = document.getElementById('back');
    backButton.addEventListener('click', () => goBack());

    reloadButton = document.getElementById('reload');
    reloadButton.addEventListener('click', () => reload());

    addButton = document.getElementById('add-button');
    addButton.addEventListener('click', () => ipcRenderer.send('openServiceSettings', null));
});

function setActiveService(serviceId) {
    const currentService = services[serviceId];
    process.nextTick(() => {
        if (currentService) {
            loadService(serviceId, currentService);
        }

        // Hide previous service
        if (services[selectedService] && services[selectedService].view) {
            services[selectedService].view.classList.remove('active');
        }

        // Show service
        if (currentService) {
            currentService.view.classList.add('active');
        }

        // Save active service ID
        selectedService = serviceId;

        // Refresh navigation
        updateNavigation();
    });
}

function loadService(serviceId, service) {
    // Load service if not loaded yet
    if (!service.view && !service.viewReady) {
        console.log('Loading service', serviceId);

        document.querySelector('#services > .loader').classList.remove('hidden');
        service.view = document.createElement('webview');
        service.view.setAttribute('enableRemoteModule', 'false');
        service.view.setAttribute('partition', 'persist:service_' + service.partition);
        service.view.setAttribute('autosize', 'true');
        service.view.setAttribute('src', emptyPage);

        // Append element to DOM
        document.querySelector('#services').appendChild(service.view);

        // Load chain
        let listener;
        service.view.addEventListener('dom-ready', listener = () => {
            service.view.removeEventListener('dom-ready', listener);

            service.view.addEventListener('dom-ready', listener = () => {
                if (service.customCSS) {
                    service.view.insertCSS(service.customCSS);
                }

                document.querySelector('#services > .loader').classList.add('hidden');
                service.li.classList.add('loaded');
                service.viewReady = true;

                updateNavigation();

                if (selectedService === null) {
                    setActiveService(serviceId);
                }
            });

            const webContents = remote.webContents.fromId(service.view.getWebContentsId());

            // Set custom user agent
            if (typeof service.customUserAgent === 'string') {
                webContents.setUserAgent(service.customUserAgent);
            }

            // Set context menu
            setContextMenu(webContents);

            // Set permission request handler
            function getUrlDomain(url) {
                let domain = url.match(/^https?:\/\/((.+?)\/|(.+))/i)[1];
                if (domain.endsWith('/')) domain = domain.substr(0, domain.length - 1);
                return domain;
            }

            function getDomainPermissions(domain) {
                let domainPermissions = service.permissions[domain];
                if (!domainPermissions) domainPermissions = service.permissions[domain] = [];
                return domainPermissions;
            }

            let serviceSession = session.fromPartition(service.view.partition);
            serviceSession.setPermissionRequestHandler(((webContents, permissionName, callback, details) => {
                let domain = getUrlDomain(details.requestingUrl);
                let domainPermissions = getDomainPermissions(domain);

                let existingPermissions = domainPermissions.filter(p => p.name === permissionName);
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
            }));
            serviceSession.setPermissionCheckHandler((webContents1, permissionName, requestingOrigin, details) => {
                console.log('Permission check', permissionName, requestingOrigin, details);
                let domain = getUrlDomain(details.requestingUrl);
                let domainPermissions = getDomainPermissions(domain);

                let existingPermissions = domainPermissions.filter(p => p.name === permissionName);
                return existingPermissions.length > 0 && existingPermissions[0].authorized;
            });

            service.view.setAttribute('src', service.url);
        });

        // Load favicon
        service.view.addEventListener('page-favicon-updated', event => {
            console.debug('Loaded favicons for', service.name, event.favicons);
            if (event.favicons.length > 0 && service.favicon !== event.favicons[0]) {
                ipcRenderer.send('setServiceFavicon', serviceId, event.favicons[0]);
                if (service.useFavicon) {
                    const img = document.createElement('img');
                    img.src = event.favicons[0];
                    img.alt = service.name;
                    img.onload = () => {
                        service.li.button.innerHTML = '';
                        service.li.button.appendChild(img);
                    };
                }
            }
        });

        // Display target urls
        service.view.addEventListener('update-target-url', (event) => {
            if (event.url.length === 0) {
                urlPreview.classList.add('hidden');
            } else {
                urlPreview.classList.remove('hidden');
                urlPreview.innerHTML = event.url;
            }
        });
    }
}

function unloadService(serviceId) {
    const service = services[serviceId];
    if (service.view && service.viewReady) {
        service.view.remove();
        service.view = null;
        service.li.classList.remove('loaded');
        service.viewReady = false;

        if (parseInt(selectedService) === serviceId) {
            selectedService = null;
            for (let i = 0; i < services.length; i++) {
                if (services[i].view && services[i].viewReady) {
                    setActiveService(i);
                    break;
                }
            }
            if (selectedService === null) {
                updateNavigation();
            }
        }
    }
}

function reloadService(serviceId) {
    const service = services[serviceId];
    if (service.view && service.viewReady) {
        console.log('Reloading service', serviceId);
        document.querySelector('#services > .loader').classList.remove('hidden');
        service.view.reload();
    } else if (!service.view && !service.viewReady) {
        loadService(serviceId, service);
    }
}

function updateServicePermissions(serviceId) {
    const service = services[serviceId];
    ipcRenderer.send('updateServicePermissions', serviceId, service.permissions);
}

function updateNavigation() {
    console.debug('Updating navigation');
    // Update active list element
    for (let i = 0; i < services.length; i++) {
        const service = services[i];

        // Active?
        if (parseInt(selectedService) === i) service.li.classList.add('active');
        else service.li.classList.remove('active');

        // Loaded?
        if (service.viewReady) service.li.classList.add('loaded');
        else service.li.classList.remove('loaded');
    }

    if (selectedService !== null && services[selectedService].viewReady) {
        console.debug('Updating navigation buttons because view is ready');
        // Update history navigation
        let view = services[selectedService].view;

        homeButton.classList.remove('disabled');

        if (view && view.canGoForward()) forwardButton.classList.remove('disabled');
        else forwardButton.classList.add('disabled');

        if (view && view.canGoBack()) backButton.classList.remove('disabled');
        else backButton.classList.add('disabled');

        reloadButton.classList.remove('disabled');

        updateStatusButton();
    }

    updateWindowTitle();
}

function updateStatusButton() {
    let protocol = services[selectedService].view.getURL().split('://')[0];
    if (!protocol) protocol = 'unknown';
    for (const c of statusButton.children) {
        if (c.classList.contains(protocol)) c.classList.add('active');
        else c.classList.remove('active');
    }
}

function updateWindowTitle() {
    if (selectedService === null) {
        ipcRenderer.send('updateWindowTitle', null);
    } else if (services[selectedService].viewReady) {
        ipcRenderer.send('updateWindowTitle', selectedService, remote.webContents.fromId(services[selectedService].view.getWebContentsId()).getTitle());
    }
}

function goHome() {
    let service = services[selectedService];
    service.view.loadURL(service.url)
        .catch(console.error);
}

function goForward() {
    let view = services[selectedService].view;
    if (view) remote.webContents.fromId(view.getWebContentsId()).goForward();
}

function goBack() {
    let view = services[selectedService].view;
    if (view) remote.webContents.fromId(view.getWebContentsId()).goBack();
}

function reload() {
    reloadService(selectedService);
}

function setContextMenu(webContents) {
    webContents.on('context-menu', (event, props) => {
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
        if (editFlags.canUndo || editFlags.canRedo || editFlags.canCut || editFlags.canCopy || editFlags.canPaste || editFlags.canDelete) {
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