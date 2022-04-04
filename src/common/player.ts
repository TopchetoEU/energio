import { NIL } from "uuid";
import { energyConsumer, energyUnit } from "./energy";
import { gameObject, gameObjectManager } from "./gameObject";
import { planet, planetsOwner } from "./planet";
import { paramProp } from "./props/decorators";
import { valProp } from "./props/property";
import { register, registerProp } from "./props/register";
import { translators } from "./props/translator";
import { planetTranslator } from "./translators";
import { vector } from "./vector";


export abstract class player extends gameObject implements energyUnit {

    @registerProp({
        isTracked: true,
        translator: translators<planet | undefined, string>()
            .from(v => gameObjectManager.getMaybe(v) as planet | undefined)
            .to(v => v?.id ?? NIL),
    })
    public ownedPlanets = new register<planet>((a, b) => a.id === b.id);
    @valProp({ isTracked: true }) public peopleAboard = 0;
    @valProp({ isTracked: true, translator: vector.pointTranslator }) public location = vector.zero;
    @valProp({ isTracked: true }) public direction: number;
    public readonly optionalConsumer = false; // N/A

    @valProp({ isTracked: true }) public abstract readonly name: string;

    public get production() {
        return this.ownedPlanets.array.map(v => v.production).reduce((prev, curr) => prev + curr, 0);
    }
    public get consumption() {
        return this.workingConsumers.array.map(v => v.consumption).reduce((prev, curr) => prev + curr, 0);
    }

    @valProp() public selectedPlanet?: planet = undefined;

    @registerProp({ isTracked: true }) public readonly consumers = new register<energyConsumer>((a, b) => a.id === b.id);
    @registerProp({ isTracked: true }) public readonly workingConsumers = new register<energyConsumer>((a, b) => a.id === b.id);

    public constructor(
        @paramProp(valProp({ isTracked: true })) public readonly id: string,
        initialLocation?: vector | undefined,
        direction?: number | undefined
    ) {
        super(id);
        this.location = initialLocation ?? vector.zero;
        this.direction = direction ?? 0;
    
        this.ownedPlanets.onAdd.subscribe(v => v.owner = this);
        this.ownedPlanets.onRemove.subscribe(v => v.owner = undefined);
    }
}

export interface playersOwner {
    players: register<player>;
};