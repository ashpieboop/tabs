import {BrowserWindow, BrowserWindowConstructorOptions, ipcMain, IpcMainEvent} from "electron";
import Application from "./Application";
import Config from "./Config";

export default abstract class Window {
    private readonly listeners: { [channel: string]: ((event: IpcMainEvent, ...args: any[]) => void)[] } = {};
    private readonly onCloseListeners: (() => void)[] = [];

    protected readonly application: Application;
    protected readonly config: Config;
    protected readonly parent?: Window;
    protected window?: BrowserWindow;

    protected constructor(application: Application, parent?: Window) {
        this.application = application;
        this.parent = parent;
        this.config = this.application.getConfig();
    }


    public setup(options: BrowserWindowConstructorOptions) {
        console.log('Creating window', this.constructor.name);

        if (this.parent) {
            options.parent = this.parent.getWindow();
        }

        this.window = new BrowserWindow(options);
        this.window.on('close', () => {
            this.teardown();
            this.window = undefined;
        });
    }

    public teardown() {
        console.log('Tearing down window', this.constructor.name);

        for (const listener of this.onCloseListeners) {
            listener();
        }

        for (const channel in this.listeners) {
            for (const listener of this.listeners[channel]) {
                ipcMain.removeListener(channel, listener);
            }
        }

        this.window = undefined;
    }

    protected onIpc(channel: string, listener: (event: IpcMainEvent, ...args: any[]) => void): this {
        ipcMain.on(channel, listener);
        if (!this.listeners[channel]) this.listeners[channel] = [];
        this.listeners[channel].push(listener);
        return this;
    }

    public onClose(listener: () => void) {
        this.onCloseListeners.push(listener);
    }

    public toggle() {
        if (this.window) {
            if (!this.window.isFocused()) {
                console.log('Showing window', this.constructor.name);
                this.window.show();
            } else {
                console.log('Hiding window', this.constructor.name);
                this.window.hide();
            }
        }
    }

    public getWindow(): BrowserWindow {
        if (!this.window) throw Error('Window not initialized.');
        return this.window;
    }
}