export default class Meta {
    static #title = 'Tabs';
    static #devMode = null;

    static get title() {
        return this.#title;
    }

    static isDevMode() {
        if (this.#devMode === null) {
            this.#devMode = process.argv.length > 2 && process.argv[2] === '--dev';
            console.debug('Dev mode:', this.#devMode);
        }

        return this.#devMode;
    }

    /**
     * @param service {Service}
     * @param viewTitle {string}
     */
    static getTitleForService(service, viewTitle) {
        let suffix = '';
        if (typeof viewTitle === 'string' && viewTitle.length > 0) {
            suffix = ' - ' + viewTitle;
        }
        return this.title + ' - ' + service.name + suffix;
    }
}