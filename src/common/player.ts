import { energyUnit } from "../server/energy";
import { planet, planetlike } from "./planet";
import { vector } from "./vector";

export interface playerlike {
    name: string;
    id: number;
    ownedPlanets: planetlike[];
}

export abstract class player {
    public location: vector;
    public direction: number;
    public moving: boolean = false;
    protected _ownedPlanets: planet[] = [];
    public readonly id: number;

    public toPlayerLike(): playerlike {
        return {
            id: this.id,
            name: this.name,
            ownedPlanets: this._ownedPlanets.map(v => v.toPlanetLike(false)),
        };
    }

    public constructor(public readonly name: string, id: number, initialLocation?: vector | undefined, direction?: number | undefined) {
        this.id = id;
        this.location = initialLocation ?? vector.zero;
        this.direction = direction ?? 0;
    }
}
