import { energyUnit } from "./energy";
import { playerCreateData } from "./packets/server";
import { planet, planetsOwner } from "./planet";
import { objectChangeTracker, trackable, trackableObject, translator } from "./props/changeTracker";
import { arrayProperty, property, valueProperty } from "./props/property";
import { vector } from "./vector";

export abstract class player implements trackableObject, energyUnit {
    public readonly tracker;
    public readonly planetTranslator: translator<planet, number> = {
        translateFrom: v => {
            let res = this.planetOwner.planets.value.find(_v => _v.id === v);
            if (res) return res;
            else throw new Error("Invalid planet given.");
        },
        translateTo: v => v.id,
    };
    public readonly selectedPlanetTranslator: translator<planet | undefined, number> = {
        translateFrom: v => {
            if (v < 0) return undefined;
            let res = this.planetOwner.planets.value.find(_v => _v.id === v);
            if (res) return res;
            else throw new Error("Invalid planet given.");
        },
        translateTo: v => v?.id ?? -1,
    };
    public readonly creationData: playerCreateData;

    public ownedPlanets = new arrayProperty<planet>((a, b) => a.id === b.id);
    public peopleAboard = new valueProperty(0);
    public location: property<vector>;
    public direction: property<number>;
    public moving = new valueProperty(false);
    public production = new valueProperty(0);
    public consumption = new valueProperty(0);
    public selectedPlanet = new valueProperty<planet | undefined>(undefined);

    public tryConsume(amount: number, callback: () => void) {
        if (amount + this.consumption.value < this.production.value) {
            this.consumption.value += amount;
            callback();
        }
    }

    public constructor(protected planetOwner: planetsOwner, public readonly name: string, public readonly id: number, initialLocation?: vector | undefined, direction?: number | undefined) {
        this.location = new valueProperty(initialLocation ?? vector.zero);
        this.direction = new valueProperty(direction ?? 0);

        this.creationData = {
            direction: this.direction.value,
            id: id,
            location: this.location.value,
            name: name
        }

        this.tracker = new objectChangeTracker(this)
            .track('ownedPlanets', true, this.planetTranslator)
            .track('peopleAboard')
            .track('location', false, vector.pointTranslator)
            .track('selectedPlanet', false, this.selectedPlanetTranslator)
            .track('direction')
            .track('moving')
            .track('production')
            .track('consumption');
    }
}

export interface playersOwner {
    players: arrayProperty<player>;
};