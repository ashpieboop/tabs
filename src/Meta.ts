import Service from "./Service";
import path from "path";
import fs from "fs";

export default class Meta {
    public static readonly title = 'Tabs';

    // Paths
    public static readonly RESOURCES_PATH = path.resolve(__dirname, '../resources');
    public static readonly ICON_PATH = path.resolve(Meta.RESOURCES_PATH, 'images/logo.png');

    // Icons
    public static readonly BRAND_ICONS = Meta.listIcons('brands');
    public static readonly SOLID_ICONS = Meta.listIcons('solid');
    public static readonly REGULAR_ICONS = Meta.listIcons('regular');
    public static readonly ICON_SETS: IconSet[] = [
        Meta.BRAND_ICONS,
        Meta.SOLID_ICONS,
        Meta.REGULAR_ICONS,
    ];

    private static devMode?: boolean;

    public static isDevMode(): boolean {
        if (this.devMode === undefined) {
            this.devMode = process.argv.length > 2 && process.argv[2] === '--dev';
            console.debug('Dev mode:', this.devMode);
        }

        return this.devMode;
    }

    public static getTitleForService(service: Service, viewTitle: string): string {
        let suffix = '';
        if (viewTitle.length > 0) {
            suffix = ' - ' + viewTitle;
        }
        return this.title + ' - ' + service.name + suffix;
    }

    private static listIcons(set: string): IconSet {
        console.log('Loading icon set', set);
        const directory = path.resolve(Meta.RESOURCES_PATH, `images/icons/${set}`);
        const icons: { name: string; faIcon: string; set: string; }[] = [];
        const dir = `fa${set[0]}`;
        fs.readdirSync(directory).forEach(i => icons.push({
            name: i.split('.svg')[0],
            faIcon: dir + ' fa-' + i.split('.svg')[0],
            set: set,
        }));
        return icons;
    }
}

export type SpecialPages = {
    empty: string;
    connectionError: string;
    fileNotFound: string;
};

export type IconProperties = {
    name: string;
    faIcon: string;
    set: string;
};

export type IconSet = IconProperties[];
