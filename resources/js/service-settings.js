const {ipcRenderer, remote} = require('electron');
let isImageCheckbox;
let builtInIconSearchField;
let iconSelect;
let iconUrlField;

let serviceId;
let service;

ipcRenderer.on('syncIcons', (event, brands, solid) => {
    loadIcons(brands, 'brands');
    loadIcons(solid, 'solid');
});

ipcRenderer.on('loadService', (e, id, data) => {
    console.log('Load service', id);
    if (id === null) {
        document.title = 'Add a new service';
        service = {};

        document.querySelector('h1').innerText = 'Add a new service';
    } else {
        serviceId = id;
        service = data;
        document.querySelector('h1').innerText = 'Service settings';
        loadServiceValues();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    isImageCheckbox = document.querySelector('#is-image');
    builtInIconSearchField = document.querySelector('#built-in-icon-search');
    iconSelect = document.querySelector('#icon-select');
    iconUrlField = document.querySelector('#icon-url');


    isImageCheckbox.addEventListener('click', () => {
        updateIconChoiceForm(isImageCheckbox.checked);
    });
    updateIconChoiceForm(isImageCheckbox.checked);

    builtInIconSearchField.addEventListener('input', updateIconSearchResults);

    document.getElementById('cancel-button').addEventListener('click', e => {
        e.preventDefault();
        remote.getCurrentWindow().close();
    });

    ipcRenderer.send('sync-settings');
});

function updateIconSearchResults() {
    const searchStr = builtInIconSearchField.value;
    iconSelect.childNodes.forEach(c => {
        if (c.dataset.icon.match(searchStr) || searchStr.match(c.dataset.icon)) {
            c.classList.remove('hidden');
        } else {
            c.classList.add('hidden');
        }
    });
}

function loadIcons(icons, set) {
    for (const icon of icons) {
        if (icon.name.length === 0) continue;
        const choice = document.createElement('label');
        choice.dataset.icon = icon.name;
        choice.classList.add('choice');

        const display = document.createElement('img');
        display.src = 'icons/' + set + '/' + icon.name + '.svg';
        choice.appendChild(display);

        const label = document.createElement('span');
        label.innerText = icon.name;
        choice.appendChild(label);

        const radio = document.createElement('input');
        radio.setAttribute('type', 'radio');
        radio.setAttribute('name', 'icon');
        radio.setAttribute('value', icon.name);
        choice.appendChild(radio);

        iconSelect.appendChild(choice);

        choice.addEventListener('click', () => {
            selectIcon(choice);
        });
    }
}

function selectIcon(choice) {
    builtInIconSearchField.value = choice.dataset.icon;
    for (const otherChoice of iconSelect.children) {
        otherChoice.classList.remove('selected');
    }
    choice.classList.add('selected');
    choice.querySelector('input[type=radio]').checked = true;
}

function updateIconChoiceForm(isUrl) {
    if (isUrl) {
        iconSelect.classList.add('hidden');
        builtInIconSearchField.parentElement.classList.add('hidden');
        iconUrlField.parentElement.classList.remove('hidden');
    } else {
        iconSelect.classList.remove('hidden');
        builtInIconSearchField.parentElement.classList.remove('hidden');
        iconUrlField.parentElement.classList.add('hidden');
    }
}

function loadServiceValues() {
    if (!service || !isImageCheckbox) {
        return;
    }

    document.getElementById('name').value = service.name;
    document.getElementById('url').value = service.url;
    document.getElementById('use-favicon').checked = service.useFavicon;
    document.getElementById('auto-load').checked = service.autoLoad;
    document.getElementById('custom-css').value = service.customCSS;

    isImageCheckbox.checked = service.isImage;
    if (service.isImage) {
        iconUrlField.value = service.icon;
    } else {
        builtInIconSearchField.value = service.icon;
        updateIconSearchResults();
        const icon = Array.from(iconSelect.querySelectorAll('label')).find(i => i.dataset.icon === service.icon);
        if (icon) {
            selectIcon(icon);
        }
    }
}

function save() {
    const formData = new FormData(document.querySelector('form'));
    service.name = formData.get('name');
    if (typeof service.partition !== 'string' || service.partition.length === 0) {
        service.partition = service.name.replace(/ /g, '-');
        service.partition = service.partition.replace(/[^a-zA-Z-_]/g, '');
    }
    service.url = formData.get('url');
    service.isImage = formData.get('isImage') === 'on';
    service.icon = formData.get('icon');
    service.useFavicon = formData.get('useFavicon') === 'on';
    service.autoLoad = formData.get('autoLoad') === 'on';
    service.customCSS = formData.get('customCSS');


    if (!isValid()) {
        return;
    }

    ipcRenderer.send('saveService', serviceId, service);
    remote.getCurrentWindow().close();
}

function isValid() {
    if (typeof service.name !== 'string' || service.name.length === 0) {
        console.log('Invalid name');
        return false;
    }
    if (typeof service.partition !== 'string' || service.partition.length === 0) {
        console.log('Invalid partition');
        return false;
    }
    if (typeof service.url !== 'string' || service.url.length === 0) {
        console.log('Invalid url');
        return false;
    }
    if (!(service.useFavicon || typeof service.icon === 'string' && service.icon.length > 0)) {
        console.log('Invalid icon');
        return false;
    }
    return true;
}