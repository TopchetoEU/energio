export interface disposable {
    dispose(): void;
    get disposed(): boolean;
}