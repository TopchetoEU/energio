import { NIL } from "uuid";
import { energyConsumer, energyUnit } from "./energy";
import { gameObject, gameObjectManager } from "./gameObject";
import { laserAttribs } from "./laser";
import { planet, planetsOwner } from "./planet";
import { afterConstructor, paramProp } from "./props/decorators";
import { valProp } from "./props/property";
import { register, registerProp } from "./props/register";
import { translators } from "./props/translator";
import { vector } from "./vector";

const translator = translators<gameObject, string>().from(v => gameObjectManager.get(v)).to(v => v.id);

export abstract class player extends gameObject implements energyUnit {
    @valProp({ isTracked: true }) public abstract readonly laserAttribs: laserAttribs;
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

    @valProp({ isTracked: true }) public abstract readonly production: number;
    @valProp({ isTracked: true }) public abstract readonly consumption: number;

    @valProp({ isTracked: true }) public abstract readonly chatBubble: string;

    @valProp() public selectedPlanet?: planet = undefined;

    public constructor(
        @paramProp(valProp({ isTracked: true })) public readonly id: string,
        initialLocation?: vector | undefined,
        direction?: number | undefined
    ) {
        super(id);
        this.location = initialLocation ?? vector.zero;
        this.direction = direction ?? 0;
    
        this.ownedPlanets.onAdd.subscribe(v => {
            v.owner = this;
        });
        this.ownedPlanets.onRemove.subscribe(v => {
            v.owner = undefined;
        });
    }

    // @afterConstructor()
    // private afterConstr() {
        
    // }
}

export interface playersOwner {
    players: register<player>;
};