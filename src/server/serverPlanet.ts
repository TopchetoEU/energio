import { packetCode } from "../common/packets";
import { planetCreateData } from "../common/packets/server";
import { planet, planetsOwner } from "../common/planet";
import { playersOwner } from "../common/player";
import { ExtMath, vector } from "../common/vector";
import { planetConfig } from "./gameConfig";
import { serverPlayer } from "./serverPlayer";

export const GROWTH_RATE = 0.005;
let nextId = 0;

export class serverPlanet extends planet {
    public update(delta: number) {
        if (this.owner) {
            this.population.value *= ExtMath.drag(GROWTH_RATE, delta);
            this.production.value = this.productionPerCapita * this.population.value / 1000;
            if (this.population.value > this.limit) this.population.value = this.limit;
        }
        else {
            this.population.value = 0;
        }
    }

    constructor(config: planetConfig, playersOwner: playersOwner) {
        super(playersOwner, ++nextId, config.prodPerCapita, config.limit, config.normalSrc, config.colonySrc, config.selectedSrc, config.name, new vector(config.location.x, config.location.y));
        this.population.onChange.subscribe(v => {
            this.productionPerCapita * v / 1000;
            if (v < 0.0001) this.owner.value = undefined;
        });
        this.owner.onChange.subscribe(v => {
            this.owner?.value?.ownedPlanets.remove(this);
            v?.ownedPlanets.add(this);
        });
    }
}