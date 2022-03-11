import { point } from "../common/packets";
import * as fs from "fs";

export interface starterPlanetConfig {
    name: string;
    limit: number;
    normalSrc: string;
    colonySrc: string;
    selectedSrc: string;
    prodPerCapita: number;
}
export interface planetConfig {
    location: point;
    name: string;
    limit: number;
    normalSrc: string;
    colonySrc: string;
    selectedSrc: string;
    prodPerCapita: number;
}

export interface gameConfig {
    planets: planetConfig[];
    starter: starterPlanetConfig;
}

export function getConfig(): gameConfig {
    return {
        planets: JSON.parse(fs.readFileSync(__dirname + '/../../config/planets.json').toString()),
        starter: JSON.parse(fs.readFileSync(__dirname + '/../../config/starterplanet.json').toString()),
    };
}