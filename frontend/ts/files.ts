/* eslint-disable @typescript-eslint/no-explicit-any */
function requireAll(r: any) {
    r.keys().forEach(r);
}

requireAll((<any>require).context('../', true, /\.html$/));
requireAll((<any>require).context('../images/', true, /\.(.+)$/));
