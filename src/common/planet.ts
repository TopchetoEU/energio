import { energyUnit } from "./energy";
import { planetCreateData } from "./packets/server";
import { player, playersOwner } from "./player";
import { arrayProperty, valueProperty } from "./props/property";
import { vector } from "./vector";

export abstract class planet implements energyUnit {
    public readonly location: vector;

    public owner = new valueProperty<player | undefined>(undefined, (a, b) => (a?.id ?? -1) === (b?.id ?? -1));
    public population = new valueProperty(0);
    public production = new valueProperty(0);
    public consumption = new valueProperty(0);

    public constructor(
        protected readonly playersOwner: playersOwner,
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
    }
}

export interface planetsOwner {
    planets: arrayProperty<planet>;
}