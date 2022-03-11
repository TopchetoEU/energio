export interface energyConsumer {
    get consumption(): number;
}

export interface energyProducer {
    get production(): number;
}

export interface energyUnit extends energyProducer, energyConsumer {
    get balance(): number;
}
