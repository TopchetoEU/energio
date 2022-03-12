import { packetCode } from "../common/packets";
import { syncPlanet } from "../common/packets/server";
import { planet } from "../common/planet";
import { ExtMath, vector } from "../common/vector";
import { planetConfig } from "./gameConfig";
import { serverPlayer } from "./serverPlayer";

export const GROWTH_RATE = 0.01;
let nextId = 0;

export class serverPlanet extends planet {
    public get production(): number {
        return this.productionPerCapita * this.population / 1000;
    }

    public update(delta: number) {
        if (this.owner) {
            this.population *= ExtMath.drag(GROWTH_RATE, delta);
            if (this.population > this.limit) this.population = this.limit;
        }
        else {
            this.population = 0;
            this.owner = undefined;
        }
    }
    public async sync(players: serverPlayer[]): Promise<void> {
        for (let player of players) {
            await player.connection.sendPacket(packetCode.SYNCPLANET, {
                planetId: this.id,
                population: this.population,
                production: this.production,
            });
        }
    }

    constructor(config: planetConfig) {
        super(++nextId, config.prodPerCapita, config.limit, config.normalSrc, config.colonySrc, config.selectedSrc, config.name, new vector(config.location.x, config.location.y));
    }
}