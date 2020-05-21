import Service from "./Service";

export default class Meta {
    public static readonly title = 'Tabs';
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
}