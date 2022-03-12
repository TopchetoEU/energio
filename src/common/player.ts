import { energyUnit } from "../server/energy";
import { planet, planetOwner } from "./planet";
import { objectChangeTracker, trackable, trackableObject, translator } from "./props/changeTracker";
import { arrayProperty, property, valueProperty } from "./props/property";
import { vector } from "./vector";

export abstract class player implements trackableObject, energyUnit {
    public readonly tracker;

    public ownedPlanets = new arrayProperty<planet>((a, b) => a.id === b.id);
    public peopleAboard = new valueProperty(0);
    public location: property<vector>;
    public direction: property<number>;
    public moving = new valueProperty(false);
    public production = new valueProperty(0);
    public consumption = new valueProperty(0);

    public constructor(private planetOwner: planetOwner, public readonly name: string, public readonly id: number, initialLocation?: vector | undefined, direction?: number | undefined) {
        this.location = new valueProperty(initialLocation ?? vector.zero);
        this.direction = new valueProperty(direction ?? 0);

        this.tracker = new objectChangeTracker(this)
            .track('ownedPlanets', true, this.idTranslator)
            .track('peopleAboard')
            .track('location', false, vector.pointTranslator)
            .track('direction')
            .track('moving')
            .track('production')
            .track('consumption');
    }

    public readonly idTranslator: translator<planet, number> = {
        translateFrom: v => {
            let res = this.planetOwner.planets.find(_v => _v.id === v);
            if (res) return res;
            else throw new Error("Invalid planet given.");
        },
        translateTo: v => v.id,
    };
}
