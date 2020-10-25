declare module "single-instance" {
    export default class SingleInstance {
        public constructor(lockName: string);

        public lock(): Promise<void>;
    }
}
