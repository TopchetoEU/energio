import { energyUnit } from "../server/energy";
import { player, playerlike } from "./player";
import { vector } from "./vector";

export interface planetlike {
    id: number;
    population: number;
    production: number;
    consumption: number;
    productionPerCapita: number;
    owner?: playerlike;
}
export abstract class planet implements energyUnit {
    public readonly location: vector;
    public owner?: player;
    public population: number = 0;

    public get balance(): number {
        return this.production - this.consumption;
    }
    public abstract get production(): number;
    public get consumption() {
        return this.limit * this.productionPerCapita;
    }

    public toPlanetLike(keepOwner: boolean = true): planetlike {
        return {
            consumption: this.consumption,
            id: this.id,
            population: this.population,
            production: this.production,
            productionPerCapita: this.productionPerCapita,
            owner: keepOwner ? this.owner?.toPlayerLike() : undefined,
        };
    }

    public constructor(
        public readonly id: number,
        public readonly productionPerCapita: number,
        public readonly limit: number,
        public readonly normalSrc: string,
        public readonly colonySrc: string,
        public readonly selectedSrc: string,
        initLocation: vector
    ) {
        this.location = initLocation;
    }
}