import { valueProperty } from "../common/props/property";

export interface energyConsumer {
    consumption: valueProperty<number>;
}

export interface energyProducer {
    production: valueProperty<number>;
}

export interface energyUnit extends energyProducer, energyConsumer {
}
