import { fromEvent, map, Observable, share, Subject } from "rxjs";
import { socket } from "../common/socket";

export class clientSocket implements socket {
    private ws: WebSocket;
    private _subject: Subject<string>;
    private _closeSubject: Subject<void> = new Subject();

    get onClose(): Observable<void> {
        return this._closeSubject;
    }
    get closed() {
        return this.ws.readyState === WebSocket.CLOSED;
    }
    get onMessage(): Observable<string> {
        return this._subject;
    }
    send(data: string): Promise<void> {
        this.ws.send(data);
        return Promise.resolve();
    }
    close(): void {
        if (this.ws.readyState === WebSocket.CLOSED) return;
        this.ws.close();
    }

    public constructor(socket: WebSocket) {
        this.ws = socket;
        this._subject = new Subject();
        
        this.ws.onmessage = msg => this._subject.next(msg.data);
        this.ws.onclose = () => this._closeSubject.next();
    }
}