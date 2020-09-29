export default class Service {
    public name: string;
    public partition: string;
    public url: string;

    public icon?: string;
    public isImage: boolean = false;

    public useFavicon: boolean = true;
    public favicon?: string;

    public autoLoad: boolean = false;
    public customCSS?: string;
    public customUserAgent?: string;
    public permissions: ServicePermissions = {};

    [p: string]: unknown;

    public constructor(
        partition: string | Pick<Service, keyof Service>,
        name?: string,
        icon?: string,
        isImage?: boolean,
        url?: string,
        useFavicon?: boolean,
    ) {
        const data = arguments.length === 1 ? partition as Record<string, unknown> : {
            name,
            icon,
            isImage,
            url,
            useFavicon,
        };

        if (typeof data.name === 'string') this.name = data.name;
        else throw new Error('A service must have a name');

        if (typeof data.partition === 'string') this.partition = data.partition;
        else this.partition = this.name;

        if (typeof data.url === 'string') this.url = data.url;
        else throw new Error('A service must have a url.');

        if (typeof data.icon === 'string') this.icon = data.icon;
        if (typeof data.isImage === 'boolean') this.isImage = data.isImage;

        if (typeof data.useFavicon === 'boolean') this.useFavicon = data.useFavicon;
        if (typeof data.favicon === 'string') this.favicon = data.favicon;

        if (typeof data.autoLoad === 'boolean') this.autoLoad = data.autoLoad;
        if (typeof data.customCSS === 'string') this.customCSS = data.customCSS;
        if (typeof data.customUserAgent === 'string') this.customUserAgent = data.customUserAgent;
        if (typeof data.permissions === 'object' && data.permissions !== null) {
            for (const domain of Object.keys(data.permissions)) {
                this.permissions[domain] = [];

                const permissions = (data.permissions as Record<string, unknown>)[domain];

                if (Array.isArray(permissions)) {
                    for (const permission of permissions) {
                        if (typeof permission.name === 'string' &&
                            typeof permission.authorized === 'boolean') {
                            this.permissions[domain]?.push(permission);
                        }
                    }
                }
            }
        }
    }
}


export type ServicePermission = {
    name: string;
    authorized: boolean;
};
export type ServicePermissions = Record<string, ServicePermission[] | undefined>;
