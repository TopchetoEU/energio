import { planet } from "./planet";
import { vector } from "./vector";

export abstract class player {
    public location: vector;
    public direction: number;
    public moving: boolean = false;
    public ownedPlanets: planet[] = [];
    public readonly id: number;

    public constructor(public readonly name: string, id: number, initialLocation?: vector | undefined, direction?: number | undefined) {
        this.id = id;
        this.location = initialLocation ?? vector.zero;
        this.direction = direction ?? 0;
    }
}
