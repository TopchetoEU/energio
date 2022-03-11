import { Observable } from "rxjs";

export interface socket {
    get onMessage(): Observable<string>;
    get onClose(): Observable<void>;
    get closed(): boolean;
    send(data: string): Promise<void>;
    close(): void;
}