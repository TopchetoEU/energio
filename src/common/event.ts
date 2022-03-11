import { Observable } from "rxjs";

export type handle<T> = (args: T) => void;


export interface event<T> {
    attach(handle: handle<T>): handle<T>;
    detach(handle: handle<T>): void;
    toObservable(): Observable<T>;
}

export class invocableEvent<T> implements event<T> {
    private handles: Array<(arg: T) => void> = [];

    public attach(handle: (arg: T) => void): (arg: T) => void {
        this.handles.push(handle);
        return handle;
    }
    public detach(handle: (arg: T) => void) {
        this.handles = this.handles.filter(v => v === handle);
    }

    public invoke(arg: T) {
        this.handles.forEach(v => v(arg));
    }

    public toObservable(): Observable<T> {
        return new Observable<T>(sub => {
            let handle = this.attach(arg => sub.next(arg));
            return () => this.detach(handle);
        });
    }
}
