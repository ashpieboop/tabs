class Service {
    constructor(partition, name, icon, isImage, url, useFavicon) {
        if (arguments.length === 1) {
            let data = arguments[0];
            for (let k in data) {
                if (data.hasOwnProperty(k)) {
                    this[k] = data[k];
                }
            }
        } else {
            this.partition = partition;
            this.name = name;
            this.icon = icon;
            this.isImage = isImage;
            this.url = url;
            this.useFavicon = useFavicon;
        }

        for (let k in Service.requiredProperties) {
            if (Service.requiredProperties.hasOwnProperty(k)) {
                if (!this.hasOwnProperty(k) || this[k] === undefined) {
                    this[k] = Service.requiredProperties[k];
                }
            }
        }
    }
}

Service.requiredProperties = {
    'partition': null,
    'name': null,
    'icon': null,
    'isImage': null,
    'url': null,
    'useFavicon': true,
    'autoLoad': false,
    'customCSS': null,
    'customUserAgent': null,
    'permissions': {},
};

export default Service;
