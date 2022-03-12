import { energyUnit } from "../server/energy";
import { player } from "./player";
import { objectChangeTracker, trackableObject } from "./props/changeTracker";
import { valueProperty } from "./props/property";
import { vector } from "./vector";

export abstract class planet implements energyUnit, trackableObject {
    public readonly location: vector;
    public owner = new valueProperty<player | undefined>(undefined);
    public population: number = 0;
    public production = new valueProperty(0);
    public consumption = new valueProperty(0);

    public readonly creationData;

    get tracker(): objectChangeTracker {
        throw new Error("Method not implemented.");
    }

    public constructor(
        public readonly id: number,
        public readonly productionPerCapita: number,
        public readonly limit: number,
        public readonly normalSrc: string,
        public readonly colonySrc: string,
        public readonly selectedSrc: string,
        public readonly name: string,
        initLocation: vector
    ) {
        this.location = initLocation;
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
    }
}

export interface planetOwner {
    get planets(): planet[];
}