const {
    remote,
    clipboard,
} = require('electron');
const {
    Menu,
    MenuItem,
} = remote;

const webContents = remote.getCurrentWebContents();
webContents.on('context-menu', (event, props) => {
    const menu = new Menu();
    const {editFlags} = props;

    // linkURL
    if (props.linkURL.length > 0) {
        if (menu.items.length > 0) {
            menu.append(new MenuItem({type: 'separator'}));
        }

        menu.append(new MenuItem({
            label: 'Copy link URL',
            click: () => {
                clipboard.writeText(props.linkURL);
            },
        }));
        menu.append(new MenuItem({
            label: 'Open URL in default browser',
            click: () => {
                window.open(props.linkURL, '_blank');
            },
        }));
    }

    // Image
    if (props.hasImageContents) {
        if (menu.items.length > 0) {
            menu.append(new MenuItem({type: 'separator'}));
        }

        menu.append(new MenuItem({
            label: 'Copy image',
            click: () => {
                webContents.copyImageAt(props.x, props.y);
            },
        }));

        menu.append(new MenuItem({
            label: 'Save image as',
            click: () => {
                webContents.downloadURL(props.srcURL);
            },
        }));
    }

    // Text clipboard
    if (editFlags.canUndo || editFlags.canRedo || editFlags.canCut || editFlags.canCopy || editFlags.canPaste || editFlags.canDelete) {
        if (menu.items.length > 0) {
            menu.append(new MenuItem({type: 'separator'}));
        }
        if (editFlags.canUndo) {
            menu.append(new MenuItem({
                label: 'Undo',
                role: 'undo',
            }));
        }
        if (editFlags.canRedo) {
            menu.append(new MenuItem({
                label: 'Redo',
                role: 'redo',
            }));
        }

        if (menu.items.length > 0) {
            menu.append(new MenuItem({type: 'separator'}));
        }
        menu.append(new MenuItem({
            label: 'Cut',
            role: 'cut',
            enabled: editFlags.canCut,
        }));
        menu.append(new MenuItem({
            label: 'Copy',
            role: 'copy',
            enabled: editFlags.canCopy,
        }));
        menu.append(new MenuItem({
            label: 'Paste',
            role: 'paste',
            enabled: editFlags.canPaste,
        }));
        menu.append(new MenuItem({
            label: 'Delete',
            role: 'delete',
            enabled: editFlags.canDelete,
        }));
    }

    if (editFlags.canSelectAll) {
        if (menu.items.length > 0) {
            menu.append(new MenuItem({type: 'separator'}));
        }

        menu.append(new MenuItem({
            label: 'Select all',
            role: 'selectAll',
        }));
    }

    // Inspect element
    if (menu.items.length > 0) {
        menu.append(new MenuItem({type: 'separator'}));
    }

    menu.append(new MenuItem({
        label: 'Inspect element',
        click: () => {
            webContents.inspectElement(props.x, props.y);
        },
    }));


    menu.popup({
        window: remote.getCurrentWindow(),
    });
});