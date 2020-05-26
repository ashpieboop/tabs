declare module "single-instance" {
    export default class SingleInstance {
        constructor(lockName: string);

        public lock(): Promise<void>;
    }
}