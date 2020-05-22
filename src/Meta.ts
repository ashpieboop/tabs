import Service from "./Service";
import path from "path";
import fs from "fs";

export default class Meta {
    public static readonly title = 'Tabs';

    // Paths
    public static readonly RESOURCES_PATH = path.resolve(__dirname, '../resources');
    public static readonly ICON_PATH = path.resolve(Meta.RESOURCES_PATH, 'logo.png');

    // Icons
    public static readonly BRAND_ICONS = Meta.listIcons('brands');
    public static readonly SOLID_ICONS = Meta.listIcons('solid');

    private static devMode?: boolean;

    public static isDevMode() {
        if (this.devMode === undefined) {
            this.devMode = process.argv.length > 2 && process.argv[2] === '--dev';
            console.debug('Dev mode:', this.devMode);
        }

        return this.devMode;
    }

    public static getTitleForService(service: Service, viewTitle: string) {
        let suffix = '';
        if (viewTitle.length > 0) {
            suffix = ' - ' + viewTitle;
        }
        return this.title + ' - ' + service.name + suffix;
    }

    private static listIcons(set: string) {
        console.log('Loading icon set', set);
        const directory = path.resolve(Meta.RESOURCES_PATH, 'icons/' + set);
        const icons: { name: string; faIcon: string }[] = [];
        const dir = set === 'brands' ? 'fab' : 'fas';
        fs.readdirSync(directory).forEach(i => icons.push({
            name: i.split('.svg')[0],
            faIcon: dir + ' fa-' + i.split('.svg')[0],
        }));
        return icons;
    }
}
