export default class Service {
    public partition?: string;
    public name?: string;
    public icon?: string;
    public isImage?: boolean = false;
    public url?: string;
    public useFavicon?: boolean = true;
    public favicon?: string;
    public autoLoad?: boolean = false;
    public customCSS?: string;
    public customUserAgent?: string;
    public permissions?: {} = {};

    constructor(partition: string, name?: string, icon?: string, isImage?: boolean, url?: string, useFavicon?: boolean) {
        if (arguments.length === 1) {
            const data = arguments[0];
            for (const k in data) {
                if (data.hasOwnProperty(k)) {
                    (<any>this)[k] = data[k];
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
    }
}
