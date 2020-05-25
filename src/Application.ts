import {app, Menu, shell, Tray} from "electron";
import Meta from "./Meta";
import Config from "./Config";
import Updater from "./Updater";
import MainWindow from "./windows/MainWindow";

export default class Application {
    private readonly devMode: boolean;
    private readonly config: Config;
    private readonly updater: Updater;
    private readonly mainWindow: MainWindow;
    private tray?: Tray;

    constructor(devMode: boolean) {
        this.devMode = devMode;
        this.config = new Config();
        this.updater = new Updater(this.config);
        this.mainWindow = new MainWindow(this);
    }

    public async start(): Promise<void> {
        console.log('Starting app');

        this.setupSystemTray();
        this.mainWindow.setup();
        this.setupElectronTweaks();

        // Check for updates
        this.updater.checkAndPromptForUpdates(this.mainWindow.getWindow()).then(() => {
            console.log('Update check successful.');
        }).catch(console.error);

        console.log('App started');
    }

    public async stop(): Promise<void> {
        this.mainWindow.teardown();
    }

    public getConfig(): Config {
        return this.config;
    }

    public getUpdater(): Updater {
        return this.updater;
    }

    public isDevMode(): boolean {
        return this.devMode;
    }

    private setupElectronTweaks() {
        // Open external links in default OS browser
        app.on('web-contents-created', (e, contents) => {
            if (contents.getType() === 'webview') {
                console.log('Setting external links to open in default OS browser');
                contents.on('new-window', (e, url) => {
                    e.preventDefault();
                    if (url.startsWith('https://')) {
                        shell.openExternal(url).catch(console.error);
                    }
                });
            }
        });
    }

    private setupSystemTray() {
        console.log('Loading system Tray');
        this.tray = new Tray(Meta.ICON_PATH);
        this.tray.setToolTip('Tabs');
        this.tray.setContextMenu(Menu.buildFromTemplate([
            {label: 'Tabs', enabled: false},
            {label: 'Open Tabs', click: () => this.mainWindow.getWindow().show()},
            {type: 'separator'},
            {label: 'Quit', role: 'quit'}
        ]));
        this.tray.on('click', () => this.mainWindow.toggle());
    }
}