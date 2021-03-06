import { Subject } from "rxjs";
import { connection } from "websocket";
import { socket } from "../common/socket";

export class serverSocket implements socket {
    private _connection: connection;
    private _subject: Subject<string> = new Subject();
    private _closeSubject: Subject<void> = new Subject();

    public get onMessage(): Subject<string> {
        return this._subject;
    }
    public get onClose(): Subject<void> {
        return this._closeSubject;
    }
    public send(data: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this._connection.send(data, err => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
    public close(detachHandles?: boolean): void {
        if (this._connection.closeReasonCode !== -1) return;
        this._connection.close();
        if (detachHandles) {
            this._subject.complete();
            this._closeSubject.complete();
            this._closeSubject = new Subject();
            this._subject = new Subject();
        }
    }

    constructor(connection: connection) {
        this._connection = connection;
        if (this._connection.closeReasonCode === -1) {
            this._subject = new Subject();
            this._connection.on('message', (data) => {
                    if (data.type === "binary") this._subject.next(data.binaryData.toString("utf8"));
                    else this._subject.next(data.utf8Data);
                }
            );
            this._connection.on('close', () => this._closeSubject.next());
        }
    }
    get closed(): boolean {
        return this._connection.closeReasonCode !== -1;
    }
}