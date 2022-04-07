import { NIL } from "uuid";
import { energyUnit } from "./energy";
import { freeFunc, gameObject, gameObjectBase, gameObjectManager } from "./gameObject";
import { laserAttribs } from "./laser";
import { planet } from "./planet";
import { valProp } from "./props/property";
import { register, registerProp } from "./props/register";
import { translators } from "./props/translator";
import { vector } from "./vector";

const translator = translators<gameObjectBase, string>().from(v => gameObjectManager.get(v)).to(v => v.id);

export abstract class player extends gameObjectBase implements energyUnit {
    @valProp({ isTracked: true }) public abstract readonly laserAttribs: laserAttribs;
    @registerProp({
        isTracked: true,
        translator: translators<planet | undefined, string>()
            .from(v => gameObjectManager.getMaybe(v) as planet | undefined)
            .to(v => v?.id ?? NIL),
    })
    public ownedPlanets = new register<planet>((a, b) => a.id === b.id);
    @valProp({ isTracked: true }) public peopleAboard = 0;
    @valProp({ isTracked: true, translator: vector.pointTranslator }) public abstract readonly location: vector;
    @valProp({ isTracked: true }) public abstract readonly direction: number;
    public readonly optionalConsumer = false; // N/A

    @valProp({ isTracked: true }) public abstract readonly name: string;

    @valProp({ isTracked: true }) public abstract readonly production: number;
    @valProp({ isTracked: true }) public abstract readonly consumption: number;

    @valProp({ isTracked: true }) public abstract readonly chatBubble: string;

    @valProp() public selectedPlanet?: planet = undefined;

    public constructor(
        id: string,
        free?: freeFunc<player>
    ) {
        super(id, free as freeFunc<gameObject>);
    
        this.ownedPlanets.onAdd.subscribe(v => {
            v.owner = this;
        });
        this.ownedPlanets.onRemove.subscribe(v => {
            v.owner = undefined;
        });
    }
}

export interface playersOwner {
    players: register<player>;
};