import { player } from "./player";
import { vector } from "./vector";

export abstract class planet {
    protected _location: vector;
    protected _ownerId?: number;
    protected _peopleCount: number = 0;
    public readonly id: number;
    public readonly limit: number;

    public get location(): vector {
        return this._location;
    }
    public get peopleCount(): number {
        return this._peopleCount;
    }
    public abstract get owner(): player | null;

    public constructor(limit: number, initLocation: vector, id: number) {
        this.id = id;
        this.limit = limit;
        this._location = initLocation;
    }
}