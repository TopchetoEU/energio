import { Observable } from "rxjs";
import { NIL } from "uuid";
import { energyUnit } from "./energy";
import { freeFunc, gameObject, gameObjectBase, gameObjectManager } from "./gameObject";
import { player } from "./player";
import { valProp } from "./props/property";
import { register } from "./props/register";
import { translator, translators } from "./props/translator";
import { playerTranslator } from "./translators";
import { vector } from "./vector";

export abstract class planet extends gameObjectBase implements energyUnit {

    @valProp({ isTracked: true, translator: vector.pointTranslator }) public abstract readonly location: vector;

    @valProp({
        isTracked: true,
        translator: translators<player | undefined, string>()
            .from(v => gameObjectManager.getMaybe(v) as player | undefined)
            .to(v => v?.id ?? NIL),
    }) public owner?: player;
    @valProp({ isTracked: true }) public population: number = 0;
    @valProp({ isTracked: true }) public abstract readonly production: number;
    @valProp({ isTracked: true }) public abstract readonly consumption: number;

    @valProp({ isTracked: true }) public abstract readonly productionPerCapita: number;
    @valProp({ isTracked: true }) public abstract readonly limit: number;
    @valProp({ isTracked: true }) public abstract readonly normalSrc: string;
    @valProp({ isTracked: true }) public abstract readonly colonySrc: string;
    @valProp({ isTracked: true }) public abstract readonly selectedSrc: string;
    @valProp({ isTracked: true }) public abstract readonly name: string;
    @valProp({ isTracked: true, translator: vector.pointTranslator }) public abstract readonly renderOffset: vector;

    public readonly ownerChanged!: Observable<player | undefined>;
    public readonly populationChanged!: Observable<number>;
    public readonly productionChanged!: Observable<number>;

    @valProp() public readonly optionalConsumer: boolean = false;

    public constructor(
        id: string,
        free?: freeFunc<planet>
    ) {
        super(id, free as freeFunc<gameObject>);
        let oldOwner: player | undefined = undefined;

        this.ownerChanged.subscribe(v => {
            oldOwner?.ownedPlanets?.remove(this);
            v?.ownedPlanets?.add(this);
            oldOwner = v;
        });
    }
}

export interface planetsOwner {
    readonly planets: register<planet>;
}