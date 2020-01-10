export default class Meta {
    static #devMode = null;

    static isDevMode() {
        if(this.#devMode === null) {
            this.#devMode = process.argv.length > 2 && process.argv[2] === '--dev';
            console.debug('Dev mode:', this.#devMode);
        }

        return this.#devMode;
    }
}