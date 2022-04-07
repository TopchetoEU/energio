import { gameObject } from "./gameObject";
import { property } from "./props/property";

export interface energyConsumer extends gameObject {
    readonly consumption: number;
    readonly optionalConsumer: boolean;
}

export interface energyProducer extends gameObject {
    /**
     * The amount of terawatts that the object produces
     */
    readonly production: number;
}

export interface energyUnit extends energyProducer, energyConsumer {
}
