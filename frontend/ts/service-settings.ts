import {ipcRenderer, remote} from "electron";

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

let serviceId: number;
let service: any;

ipcRenderer.on('syncIcons', (event, iconSets) => {
    let icons: any[] = [];
    for (const set of iconSets) {
        icons = icons.concat(set);
    }
    loadIcons(icons);
});

ipcRenderer.on('loadService', (e, id, data) => {
    console.log('Load service', id);
    if (id === null) {
        document.title = 'Add a new service';
        service = {};

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
        updateIconChoiceForm(isImageCheckbox?.checked);
    });
    updateIconChoiceForm(isImageCheckbox?.checked);

    builtInIconSearchField?.addEventListener('input', updateIconSearchResults);

    document.getElementById('cancel-button')?.addEventListener('click', e => {
        e.preventDefault();
        remote.getCurrentWindow().close();
    });

    ipcRenderer.send('sync-settings');

    document.getElementById('userAgentAutoFill')?.addEventListener('click', () => {
        let customUserAgent = document.getElementById('custom-user-agent');
        if (customUserAgent) {
            (<HTMLInputElement>customUserAgent).value = 'Mozilla/5.0 (X11; Linux x86_64; rv:73.0) Gecko/20100101 Firefox/73.0';
        }
    });
});

function updateIconSearchResults() {
    const searchStr: string = builtInIconSearchField!.value;
    (<any>iconSelect?.childNodes).forEach((c: HTMLElement) => {
        let parts = c.dataset.icon?.split('/') || '';
        let iconName = parts[1] || parts[0];
        if (iconName.match(searchStr) || searchStr.match(iconName)) {
            c.classList.remove('hidden');
        } else {
            c.classList.add('hidden');
        }
    });
}

function loadIcons(icons: any[]) {
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
        for (const otherChoice of <any>iconSelect.children) {
            otherChoice.classList.remove('selected');
        }
    }
    choice.classList.add('selected');
    let radio: HTMLInputElement | null = choice.querySelector('input[type=radio]');
    if (radio) radio.checked = true;
}

function updateIconChoiceForm(isUrl: any) {
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
    if (urlInput) urlInput.value = service.url;
    if (useFaviconInput) useFaviconInput.checked = service.useFavicon;
    if (autoLoadInput) autoLoadInput.checked = service.autoLoad;
    if (customCssInput) customCssInput.value = service.customCSS;
    if (customUserAgentInput) customUserAgentInput.value = service.customUserAgent;

    isImageCheckbox.checked = service.isImage;
    if (service.isImage) {
        if (iconUrlField) iconUrlField.value = service.icon;
    } else {
        if (builtInIconSearchField) builtInIconSearchField.value = service.icon;
        updateIconSearchResults();
        let labels = iconSelect?.querySelectorAll('label');
        if (labels) {
            const icon = Array.from(labels).find(i => i.dataset.icon === service.icon);
            if (icon) {
                selectIcon(icon);
            }
        }
    }
}

(window as any).save = () => {
    let form = document.querySelector('form');
    if (!form) return;
    const formData = new FormData(form);
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

    let customUserAgent = (<string>formData.get('customUserAgent')).trim();
    service.customUserAgent = customUserAgent.length === 0 ? null : customUserAgent;

    if (!isValid()) {
        return;
    }

    ipcRenderer.send('saveService', serviceId, service);
    remote.getCurrentWindow().close();
};

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
