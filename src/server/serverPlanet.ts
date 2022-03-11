import { planet } from "../common/planet";
import { ExtMath, vector } from "../common/vector";
import { planetConfig } from "./gameConfig";
import { serverPlayer } from "./serverPlayer";

export const GROWTH_RATE = 1.01;
let nextId = 0;

export class serverPlanet extends planet {
    public get production(): number {
        return this.productionPerCapita * this.population;
    }

    public update(delta: number) {
        if (this.owner || this.population) {
            this.population *= ExtMath.drag(GROWTH_RATE, delta);
            if (this.population > this.limit) this.population = this.limit;
        }
        else {
            this.population = 0;
            this.owner = undefined;
        }
    }

    constructor(config: planetConfig) {
        super(++nextId, config.prodPerCapita, config.limit, config.normalSrc, config.colonySrc, config.selectedSrc, new vector(config.location.x, config.location.y));
    }
}