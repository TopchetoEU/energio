import { packetCode } from "../common/packets";
import { planetCreateData } from "../common/packets/server";
import { planet, planetsOwner } from "../common/planet";
import { player, playersOwner } from "../common/player";
import { ExtMath, vector } from "../common/vector";
import { planetConfig } from "./gameConfig";
import { serverPlayer } from "./serverPlayer";
import { objectChangeTracker, trackableObject, translator } from "../common/props/changeTracker";

export const GROWTH_RATE = 0.005;
let nextId = 0;

export class serverPlanet extends planet implements trackableObject {
    public readonly tracker: objectChangeTracker;
    public readonly creationData: planetCreateData;
    public readonly idTranslator: translator<player | undefined, number> = {
        translateFrom: v => {
            if (v < 0) return undefined;
            let res = this.playersOwner.players.value.find(_v => _v.id === v);
            if (res) return res;
            else throw new Error("Invalid planet given.");
        },
        translateTo: v => v?.id ?? -1,
    };

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

        this.creationData = {
            id: this.id,
            name: this.name,
            limit: this.limit,
            normalSrc: this.normalSrc,
            colonySrc: this.colonySrc,
            selectedSrc: this.selectedSrc,
            productionPerCapita: this.productionPerCapita,
            location: this.location,
        };
        this.tracker = new objectChangeTracker(this)
            .prop('owner', false, this.idTranslator)
            .prop('population')
            .prop('production')
            .prop('consumption');
    }
}