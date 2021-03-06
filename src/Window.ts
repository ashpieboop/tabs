import {BrowserWindow, BrowserWindowConstructorOptions, ipcMain, IpcMainEvent} from "electron";
import Application from "./Application";
import Config from "./Config";

export default abstract class Window {
    private readonly listeners: {
        [channel: string]: ((event: IpcMainEvent, ...args: unknown[]) => void)[] | undefined
    } = {};
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


    public setup(options: BrowserWindowConstructorOptions): void {
        console.log('Creating window', this.constructor.name);

        if (this.parent) {
            options.parent = this.parent.getWindow();
        }

        this.window = new BrowserWindow(options);
        this.window.on('close', () => {
            this.teardown();
            this.window = undefined;
        });

        this.onIpc('close-window', (
            event,
            constructorName: string,
        ) => {
            if (constructorName === this.constructor.name) {
                console.log('Closing', this.constructor.name);
                const window = this.getWindow();
                if (window.closable) {
                    window.close();
                }
            }
        });
    }

    public teardown(): void {
        console.log('Tearing down window', this.constructor.name);

        for (const listener of this.onCloseListeners) {
            listener();
        }

        for (const channel in this.listeners) {
            const listeners = this.listeners[channel];
            if (!listeners) continue;

            for (const listener of listeners) {
                ipcMain.removeListener(channel, listener);
            }
        }

        this.window = undefined;
    }

    // This is the spec of ipcMain.on()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    protected onIpc(channel: string, listener: (event: IpcMainEvent, ...args: any[]) => void): this {
        ipcMain.on(channel, listener);
        if (!this.listeners[channel]) this.listeners[channel] = [];
        this.listeners[channel]?.push(listener);
        return this;
    }

    public onClose(listener: () => void): void {
        this.onCloseListeners.push(listener);
    }

    public toggle(): void {
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
        else if (this.window.isDestroyed()) throw Error('Window destroyed.');
        return this.window;
    }
}
