import { Observable, Subject } from "rxjs";
import { gameObject } from "./gameObject";
import { point } from "./packets";
import { vector } from "./vector";

export interface laserAttribs {
    readonly velocity: number;
    readonly size: number;
    readonly decay: number;
    readonly power: number;
    readonly frequency: number;
}

export interface laserCreationData {
    readonly velocity: point;
    readonly location: point;
    readonly size: number;
    readonly decay: number;
    readonly power: number;
}

export class laser extends gameObject {
    private _onDecay = new Subject<void>();

    private initLoc;

    public get onDecay(): Observable<void> {
        return this._onDecay;
    }

    public update(delta: number) {
        this.power -= this.decay * delta;
        if (this.power < 0) {
            this._onDecay.next();
            this._onDecay.complete();
        }
    }

    public constructor(
        id: string,
        public velocity: vector,
        public location: vector,
        public readonly size: number,
        public readonly decay: number,
        public power: number
    ) {
        super(id);
        this.initLoc = location;
    }
}