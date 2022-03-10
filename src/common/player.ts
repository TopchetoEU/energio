import { game } from "./game";
import { EPSILON, vector } from "./vector";

export abstract class player {
    private _name: string;
    protected _location: vector;
    protected _direction: number;
    protected _moving: boolean = false;

    public get name() {
        return this._name;
    }

    public get location() {
        return this._location;
    }
    public get direction() {
        return this._direction;
    }

    public get moving() {
        return this._moving;
    }

    public constructor(name: string, initialLocation?: vector | undefined, direction?: number | undefined) {
        this._name = name;
        this._location = initialLocation ?? vector.zero;
        this._direction = direction ?? 0;
    }
}
