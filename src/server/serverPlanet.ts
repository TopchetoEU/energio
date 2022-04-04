import { planet } from "../common/planet";
import { ExtMath, vector } from "../common/vector";
import { locatedPlanetConfig } from "./gameConfig";
import { objectChangeTracker, trackableObject } from "../common/props/changes";
import { getNextObjId } from "./server";
import { afterConstructor, constructorExtender, propOwner, trackable } from "../common/props/decorators";
import { hitboxOwner } from "./physics/hitboxOwner";
import { hitbox } from "./physics/hitbox";

export const GROWTH_RATE = 0.005;

@constructorExtender()
@trackable()
@propOwner()
export class serverPlanet extends planet implements trackableObject, hitboxOwner {
    public readonly renderOffset: vector;
    public readonly productionPerCapita: number;
    public readonly limit: number;
    public readonly normalSrc: string;
    public readonly colonySrc: string;
    public readonly selectedSrc: string;
    public readonly name: string;
    public production: number = 0;
    public readonly consumption: number = this.productionPerCapita * this.population / 1000;
    public readonly tracker = new objectChangeTracker(this);
    public readonly hitbox: hitbox;

    public update(delta: number) {
        if (this.owner) {
            this.population *= ExtMath.drag(GROWTH_RATE, delta);
            if (this.population > this.limit) this.population = this.limit;
        }
        else {
            this.population = 0;
        }
    }

    constructor(config: locatedPlanetConfig) {
        super(getNextObjId(), vector.fromPoint(config.location));

        this.productionPerCapita = config.prodPerCapita;
        this.limit = config.limit;
        this.normalSrc = config.normalSrc;
        this.colonySrc = config.colonySrc;
        this.selectedSrc = config.selectedSrc;
        this.name = config.name;
        this.renderOffset = vector.fromPoint(config.offset);
        this.hitbox = new hitbox(config.diameter);
    }

    @afterConstructor()
    private _afterPropInit() {
        this.populationChanged.subscribe(v => {
            this.production = this.productionPerCapita * v / 1000;
            if (v < 0.0001) this.owner = undefined;
        });
    }
}