import {ipcRenderer, remote} from "electron";
import Service from "../../src/Service";
import {IconProperties, IconSet} from "../../src/Meta";

let isImageCheckbox: HTMLInputElement | null;
let builtInIconSearchField: HTMLInputElement | null;
let iconSelect: HTMLInputElement | null;
let iconUrlField: HTMLInputElement | null;
let h1: HTMLElement | null;
let nameInput: HTMLInputElement | null;
let urlInput: HTMLInputElement | null;
let useFaviconInput: HTMLInputElement | null;
let autoLoadInput: HTMLInputElement | null;
let customCssInput: HTMLInputElement | null;
let customUserAgentInput: HTMLInputElement | null;

let serviceId: number | null = null;
let service: Service | null = null;

ipcRenderer.on('syncIcons', (event, iconSets: IconSet[]) => {
    let icons: IconProperties[] = [];
    for (const set of iconSets) {
        icons = icons.concat(set);
    }
    loadIcons(icons);
});

ipcRenderer.on('loadService', (e, id: number | null, data?: Service) => {
    console.log('Load service', id);
    if (id === null || !data) {
        document.title = 'Add a new service';
        service = null;

        if (h1) h1.innerText = 'Add a new service';
    } else {
        serviceId = id;
        service = data;
        if (h1) h1.innerText = 'Service settings';
        loadServiceValues();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    isImageCheckbox = document.querySelector('#is-image');
    builtInIconSearchField = document.querySelector('#built-in-icon-search');
    iconSelect = document.querySelector('#icon-select');
    iconUrlField = document.querySelector('#icon-url');
    h1 = document.querySelector('h1');

    nameInput = <HTMLInputElement>document.getElementById('name');
    urlInput = <HTMLInputElement>document.getElementById('url');
    useFaviconInput = <HTMLInputElement>document.getElementById('use-favicon');
    autoLoadInput = <HTMLInputElement>document.getElementById('auto-load');
    customCssInput = <HTMLInputElement>document.getElementById('custom-css');
    customUserAgentInput = <HTMLInputElement>document.getElementById('custom-user-agent');


    isImageCheckbox?.addEventListener('click', () => {
        updateIconChoiceForm(!!isImageCheckbox?.checked);
    });
    updateIconChoiceForm(!!isImageCheckbox?.checked);

    builtInIconSearchField?.addEventListener('input', updateIconSearchResults);

    document.getElementById('cancel-button')?.addEventListener('click', e => {
        e.preventDefault();
        remote.getCurrentWindow().close();
    });

    document.querySelector('form')?.addEventListener('submit', e => {
        e.preventDefault();
        save();
    });

    ipcRenderer.send('sync-settings');

    document.getElementById('userAgentAutoFillFirefox')?.addEventListener('click', () => {
        const customUserAgent = document.querySelector<HTMLInputElement>('#custom-user-agent');
        if (customUserAgent) {
            customUserAgent.value = 'Mozilla/5.0 (X11; Linux x86_64; rv:78.0) Gecko/20100101 Firefox/78.0';
        }
    });
    document.getElementById('userAgentAutoFillChrome')?.addEventListener('click', () => {
        const customUserAgent = document.querySelector<HTMLInputElement>('#custom-user-agent');
        if (customUserAgent) {
            customUserAgent.value = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.116 Safari/537.36';
        }
    });
});

function updateIconSearchResults() {
    if (!builtInIconSearchField) throw new Error('builtInIconSearchField no initialized.');

    const searchStr: string = builtInIconSearchField.value;
    iconSelect?.childNodes.forEach((el) => {
        if (el instanceof HTMLElement) {
            const parts = el.dataset.icon?.split('/') || '';
            const iconName = parts[1] || parts[0];
            if (iconName.match(searchStr) || searchStr.match(iconName)) {
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        }
    });
}

function loadIcons(icons: IconProperties[]) {
    icons.sort((a, b) => a.name > b.name ? 1 : -1);
    for (const icon of icons) {
        if (icon.name.length === 0) continue;
        const choice = document.createElement('label');
        choice.dataset.icon = `${icon.set}/${icon.name}`;
        choice.classList.add('choice');

        const display = document.createElement('img');
        display.src = `images/icons/${icon.set}/${icon.name}.svg`;
        choice.appendChild(display);

        const label = document.createElement('span');
        label.innerText = icon.name;
        choice.appendChild(label);

        const radio = document.createElement('input');
        radio.setAttribute('type', 'radio');
        radio.setAttribute('name', 'icon');
        radio.setAttribute('value', choice.dataset.icon);
        choice.appendChild(radio);

        iconSelect?.appendChild(choice);

        choice.addEventListener('click', () => {
            selectIcon(choice);
        });
    }
}

function selectIcon(choice: HTMLElement) {
    if (builtInIconSearchField) builtInIconSearchField.value = choice.dataset.icon || '';
    if (iconSelect) {
        iconSelect.childNodes.forEach(el => {
            if (el instanceof Element) el.classList.remove('selected');
        });
    }
    choice.classList.add('selected');
    const radio: HTMLInputElement | null = choice.querySelector('input[type=radio]');
    if (radio) radio.checked = true;
}

function updateIconChoiceForm(isUrl: boolean) {
    if (isUrl) {
        iconSelect?.classList.add('hidden');
        builtInIconSearchField?.parentElement?.classList.add('hidden');
        iconUrlField?.parentElement?.classList.remove('hidden');
    } else {
        iconSelect?.classList.remove('hidden');
        builtInIconSearchField?.parentElement?.classList.remove('hidden');
        iconUrlField?.parentElement?.classList.add('hidden');
    }
}

function loadServiceValues() {
    if (!service || !isImageCheckbox) {
        return;
    }

    if (nameInput) nameInput.value = service.name;
    if (urlInput) urlInput.value = service.url || '';
    if (useFaviconInput) useFaviconInput.checked = service.useFavicon;
    if (autoLoadInput) autoLoadInput.checked = service.autoLoad;
    if (customCssInput) customCssInput.value = service.customCSS || '';
    if (customUserAgentInput) customUserAgentInput.value = service.customUserAgent || '';

    isImageCheckbox.checked = service.isImage;
    if (service.isImage && service.icon) {
        if (iconUrlField) iconUrlField.value = service.icon;
    } else {
        if (builtInIconSearchField && service.icon) builtInIconSearchField.value = service.icon;
        updateIconSearchResults();
        const labels = iconSelect?.querySelectorAll('label');
        if (labels) {
            const _service = service;
            const icon = Array.from(labels).find(i => i.dataset.icon === _service.icon);
            if (icon) {
                selectIcon(icon);
            }
        }
    }
}

function save() {
    if (!service) {
        // Don't use new Service() to avoid depending on src/ file.
        service = {
            name: '',
            partition: '',
            url: '',
            isImage: false,
            useFavicon: false,
            autoLoad: false,
            permissions: {},
        };
    }

    const form = document.querySelector('form');
    if (!form) return;
    const formData = new FormData(form);
    service.name = String(formData.get('name'));
    if (service.partition.length === 0) {
        service.partition = service.name.replace(/ /g, '-');
        service.partition = service.partition.replace(/[^a-zA-Z-_]/g, '');
    }

    service.url = String(formData.get('url'));
    service.isImage = formData.get('isImage') === 'on';
    service.icon = String(formData.get('icon'));
    service.useFavicon = formData.get('useFavicon') === 'on';
    service.autoLoad = formData.get('autoLoad') === 'on';
    service.customCSS = String(formData.get('customCSS'));

    const customUserAgent = (<string>formData.get('customUserAgent')).trim();
    service.customUserAgent = customUserAgent.length === 0 ? undefined : customUserAgent;

    if (!isValid()) {
        return;
    }

    ipcRenderer.send('saveService', serviceId, service);
    remote.getCurrentWindow().close();
}

function isValid() {
    if (!service) return false;

    if (service.name.length === 0) {
        console.log('Invalid name');
        return false;
    }
    if (service.partition.length === 0) {
        console.log('Invalid partition');
        return false;
    }
    if (service.url.length === 0) {
        console.log('Invalid url');
        return false;
    }
    if (!(service.useFavicon || typeof service.icon === 'string' && service.icon.length > 0)) {
        console.log('Invalid icon');
        return false;
    }
    return true;
}
