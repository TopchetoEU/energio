import { player } from "./player";
import { vector } from "./vector";

export abstract class planet {
    protected _location: vector;
    protected _ownerId?: number;
    protected _peopleCount: number = 0;

    public abstract get energyBalance(): number;

    public get location(): vector {
        return this._location;
    }
    public get peopleCount(): number {
        return this._peopleCount;
    }
    public abstract get owner(): player | null;

    public constructor(
        public readonly id: number,
        public readonly consumption: number,
        public readonly productionPerCapita: number,
        public readonly limit: number,
        initLocation: vector
    ) {
        this._location = initLocation;
    }
}