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
    public get energyBalance() {
        return this.productionPerCapita * this.peopleCount - this.consumption;
    }

    public update(delta: number) {
        if (typeof this._ownerId !== 'undefined') {
            this._peopleCount *= Math.pow(GROWTH_RATE, 1 / delta);
            this._peopleCount = Math.round(this._peopleCount);
            if (this._peopleCount > this.limit) this._peopleCount = this.limit;
        }
        else {
            this._peopleCount = 0;
        }
    }

    constructor(consumption: number, prodPerCapita: number, limit: number, location: vector, private game: serverGame) {
        super(++nextId, consumption, prodPerCapita, limit, location);
    }
}