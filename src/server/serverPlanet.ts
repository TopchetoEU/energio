import { planet } from "../common/planet";
import { player } from "../common/player";
import { vector } from "../common/vector";
import { serverGame } from "./serverGame";

export const GROWTH_RATE = 1.01;
let nextId = 0;

export class serverPlanet extends planet {
    public get owner(): player | null {
        if (typeof this._ownerId !== 'undefined') return this.game.getPlayer(this._ownerId);
        else return null;
    }

    public update(delta: number) {
        if (typeof this._ownerId !== 'undefined') {
            this._peopleCount *= GROWTH_RATE;
            if (this._peopleCount > this.limit) this._peopleCount = this.limit;
        }
    }

    constructor(limit: number, location: vector, private game: serverGame) {
        super(limit, location, ++nextId);
    }
}