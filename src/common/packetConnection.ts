import * as ws from "websocket"
import * as rx from "rxjs"
import { packetCode } from "./packets"

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
interface error {
    type: "ERR";
    message: string;
    description?: string;
};

type response = acknowledgement | packet<unknown> | error;

let nextId = 0;

export class packetConnection {
    private _con: ws.connection;
    private _conHandle?: (...args: any) => void;
    private _timeout: number;
    private _observable: rx.Observable<response>;

    public get connection() {
        return this._con;
    }

    public sendError(message: string, description?: string): Promise<void> {
        return this.respond({ type: "ERR", description, message });
    }

    private acknowledge(id: number): Promise<void> {
        return this.respond({ type: "ACKN", id });
    }
    private respond(res: response): Promise<void> {
        return new Promise((resolve, reject) => {
            this._con.send(JSON.stringify(res), err => {
                if (err) reject(err);
                else if (res.type == "PACK") {
                    console.log(res.id);
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
            });
        });
    }
    private formatError(err: string): Promise<void> {
        return this.sendError("Invalid format.", err);
    }

    public onceAnyPacket<T>(): Promise<packet<T>> {
        return new Promise((resolve, reject) =>
            this.onAnyPacket<T>().pipe(
                rx.first(),
                rx.timeout(this._timeout)
            )
            .subscribe({
                error: reject,
                next: resolve
            })
        );
    }
    public oncePacket<T>(type: packetCode): Promise<packet<T>> {
        return new Promise((resolve, reject) =>
            this.onPacket<T>(type).pipe(
                rx.first(),
                rx.timeout(this._timeout)
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
                rx.first()
            ).subscribe({
                next: resolve,
                error: reject,
            })
        );
    }
    private onceAcknowledgement(id: number): Promise<void> {
        return new Promise((resolve, reject) =>
            this._observable.pipe(
                rx.filter(v => v.type == "ACKN" && v.id == id),
                rx.map(() => undefined),
                rx.first(),
                rx.timeout(this._timeout),
            ).subscribe({
                next: resolve,
                error: reject,
            })
        );
    }

    public onPacket<T = unknown>(type: packetCode): rx.Observable<packet<T>> {
        return this.onAnyPacket<T>().pipe(
            rx.filter(v => v.code === type)
        );
    }
    public onAnyPacket<T = unknown>(): rx.Observable<packet<T>> {
        return this._observable.pipe(
            rx.filter(v => v.type == "PACK"),
            rx.map(v => v as packet<T>)
        );
    }

    public detachHandles() {
        if (this._conHandle)
            this._con.off('message', this._conHandle);
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

    public constructor(connection: ws.connection, timeout: number = 1000) {
        this._timeout = timeout;
        this._con = connection;
        this._observable = new rx.Observable(sub => {
            this._con.on('message', this._conHandle = (msg: ws.Message) => {
                if (msg.type === "binary") {
                    this.formatError("Expected UTF8 data, got binary instead." );
                }
                else {
                    try {
                        let response = JSON.parse(msg.utf8Data) as response;
                        if (typeof response.type != 'string') {
                            this.formatError("No 'type' string property present in given JSON.");
                        }
                        else {
                            if (response.type === 'ACKN' || response.type === 'PACK') {
                                if (typeof response.id != 'number') {
                                    this.formatError("No 'id' number property present in given JSON.");
                                }
                            }
                            switch (response.type) {
                                case "PACK":
                                    if (typeof response.id != 'number')
                                    this.acknowledge(response.id);
                                case "ACKN":
                                case "ERR":
                                    sub.next(response);
                            }
                        }
                    }
                    catch {
                        this.formatError("Invalid JSON given." );
                    }
                }
            });
        });
    }
}
