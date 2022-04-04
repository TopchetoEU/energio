import * as ws from "websocket"
import * as rx from "rxjs"
import { packetCode } from "./packets"
import { socket } from "./socket";

interface acknowledgement {
    type: "ACKN";
    id: number;
};
export interface packet<T> {
    type: "PACK";
    code: packetCode;
    id: number;
    responseId?: number;
    data: T;
};
export interface error {
    type: "ERR";
    message: string;
    description?: string;
};

type response = acknowledgement | packet<unknown> | error;

let nextId = 0;

export class packetConnection {
    private _socket: socket;
    private _subscription?: rx.Subscription;
    private _timeout: number;
    private _subject: rx.Subject<response> = new rx.Subject();

    public get connection() {
        return this._socket;
    }

    public sendError(message: string, description?: string): Promise<void> {
        return this.respond({ type: "ERR", description, message });
    }

    private acknowledge(id: number): Promise<void> {
        return this.respond({ type: "ACKN", id });
    }
    private respond(res: response): Promise<void> {
        return new Promise((resolve, reject) => {
            this._socket.send(JSON.stringify(res)).then(() => {
                if (res.type == "PACK") {
                    this.onceAcknowledgement(res.id)
                        .then(resolve)
                        .catch(() => reject({
                            message: "Acknowledgement timed out",
                            description: "Your interent might be too slow."
                        }));
                }
                else {
                    resolve();
                }
            })
            .catch(err => reject(err));
        });
    }
    private formatError(err: string): Promise<void> {
        return this.sendError("Invalid format.", err);
    }

    public onceAnyPacket<T>(): Promise<packet<T>> {
        return new Promise((resolve, reject) =>
            this.onAnyPacket<T>().pipe(
                rx.first(),
                rx.timeout(this._timeout),
            )
            .subscribe({
                error: reject,
                next: resolve
            })
        );
    }
    public oncePacket<T>(...types: packetCode[]): Promise<packet<T>> {
        return new Promise((resolve, reject) =>
            this.onPacket<T>(...types).pipe(
                rx.first(),
                rx.timeout(this._timeout),
            )
            .subscribe({
                error: reject,
                next: resolve
            })
        );
    }
    public onceResponse<T = unknown>(responseTo: packet<T>): Promise<packet<T>> {
        return new Promise((resolve, reject) =>
            this.onAnyPacket<T>().pipe(
                rx.filter(v => v.id === responseTo.id),
                rx.first(),
            ).subscribe({
                next: resolve,
                error: reject,
            })
        );
    }
    private onceAcknowledgement(id: number): Promise<void> {
        return new Promise((resolve, reject) =>
            this._subject.pipe(
                rx.filter(v => {
                    return v.type == "ACKN" && v.id == id;
                }),
                rx.first(),
                rx.map(() => undefined),
                rx.timeout(this._timeout),
                rx.share(),
            ).subscribe({
                next: resolve,
                error: reject,
            })
        );
    }
    public onceError(): Promise<error> {
        return new Promise((resolve, reject) =>
            this.onError().pipe(
                rx.first(),
            ).subscribe({
                next: resolve,
                error: reject,
            })
        );
    }

    public onPacket<T = unknown>(...types: packetCode[]): rx.Observable<packet<T>> {
        return this.onAnyPacket<T>().pipe(
            rx.filter(v => types.includes(v.code)),
        );
    }
    public onAnyPacket<T = unknown>(): rx.Observable<packet<T>> {
        return this._subject.pipe(
            rx.filter(v => v.type == "PACK"),
            rx.map(v => v as packet<T>),
            rx.share(),
        );
    }
    public onError(): rx.Observable<error> {
        return this._subject.pipe(
            rx.filter(v => v.type == "ERR"),
            rx.map(v => v as error),
        );
    }

    public detachHandles() {
        this._subscription?.unsubscribe();
    }

    public sendPacket(type: packetCode, data: any, responseTo?: packet<any>): Promise<void> {
        return this.respond({
            type: "PACK",
            code: type,
            data: data,
            id: nextId++,
            responseId: responseTo?.id
        });
    }

    public close(closeWsConnection: boolean = true) {
        this.detachHandles();
        if (closeWsConnection) this.connection.close();
    }

    // private processedIds: number[] = [];

    public constructor(connection: socket, timeout: number = 100000) {
        this._timeout = timeout;
        this._socket = connection;

        this._socket.onMessage.subscribe(async msg => {
            let response: response;
            try {
                response = JSON.parse(msg) as response;

                if (typeof response.type != 'string') {
                    this.formatError("No 'type' string property present in given JSON.");
                }
                else {
                    if (response.type === 'ACKN' || response.type === 'PACK') {
                        if (typeof response.id != 'number') {
                            this.formatError("No 'id' number property present in given JSON.");
                            return;
                        }
                    }
                    if (response.type == "PACK") await this.acknowledge(response.id);
                    this._subject.next(response);
                }
            }
            catch {
                this.formatError("Invalid JSON given." );
            }
        });
    }
}
