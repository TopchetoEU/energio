import { energyUnit } from "./energy";
import { planetCreateData } from "./packets/server";
import { player, playersOwner } from "./player";
import { objectChangeTracker, trackableObject, translator } from "./props/changeTracker";
import { arrayProperty, valueProperty } from "./props/property";
import { vector } from "./vector";

export abstract class planet implements energyUnit, trackableObject {
    public readonly location: vector;
    public readonly tracker: objectChangeTracker;
    public readonly idTranslator: translator<player | undefined, number> = {
        translateFrom: v => {
            if (v < 0) return undefined;
            let res = this.playerOwner.players.value.find(_v => _v.id === v);
            if (res) return res;
            else throw new Error("Invalid planet given.");
        },
        translateTo: v => v?.id ?? -1,
    };

    public owner = new valueProperty<player | undefined>(undefined);
    public population = new valueProperty(0);
    public production = new valueProperty(0);
    public consumption = new valueProperty(0);

    public readonly creationData: planetCreateData;

    public constructor(
        private readonly playerOwner: playersOwner,
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
        this.tracker = new objectChangeTracker(this)
            .track('owner', false, this.idTranslator)
            .track('population')
            .track('production')
            .track('consumption');
    }
}

export interface planetsOwner {
    planets: arrayProperty<planet>;
}