import { energyUnit } from "./energy";
import { playerCreateData } from "./packets/server";
import { planet, planetsOwner } from "./planet";
import { objectChangeTracker, trackable, trackableObject, translator } from "./props/changeTracker";
import { arrayProperty, property, valueProperty } from "./props/property";
import { vector } from "./vector";

export abstract class player implements energyUnit {

    public ownedPlanets = new arrayProperty<planet>((a, b) => a.id === b.id);
    public peopleAboard = new valueProperty(0);
    public location: property<vector>;
    public direction: property<number>;
    public moving = new valueProperty(false);
    public production = new valueProperty(0);
    public consumption = new valueProperty(0);
    public selectedPlanet = new valueProperty<planet | undefined>(undefined);

    private consumables: { [name: string]: number } = {};

    public tryConsume(amount: number, type: string, callback: () => void) {
        if (amount + this.consumption.value < this.production.value) {
            this.consumables[type] = amount;
            this.consumption.value += amount;
            callback();
        }
    }
    public unconsume(type: string) {
        let amount = this.consumables[type];

        if (amount) this.consumption.value -= amount;
        delete this.consumables[type];
    }

    public constructor(protected planetOwner: planetsOwner, public readonly name: string, public readonly id: number, initialLocation?: vector | undefined, direction?: number | undefined) {
        this.location = new valueProperty(initialLocation ?? vector.zero);
        this.direction = new valueProperty(direction ?? 0);
    }
}

export interface playersOwner {
    players: arrayProperty<player>;
};