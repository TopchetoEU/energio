import { energyUnit } from "../server/energy";
import { player } from "./player";
import { vector } from "./vector";

export abstract class planet implements energyUnit {
    public readonly location: vector;
    public owner?: player;
    public population: number = 0;

    public get balance(): number {
        return this.production - this.consumption;
    }
    public abstract get production(): number;
    public get consumption() {
        return this.limit * this.productionPerCapita;
    }

    public constructor(
        public readonly id: number,
        public readonly productionPerCapita: number,
        public readonly limit: number,
        public readonly normalSrc: string,
        public readonly colonySrc: string,
        public readonly selectedSrc: string,
        public readonly name: string,
        initLocation: vector
    ) {
        this.location = initLocation;
    }
}