import { point } from "../common/packets";
import * as fs from "fs";

export interface planetConfig {
    offset: point;
    name: string;
    limit: number;
    normalSrc: string;
    colonySrc: string;
    selectedSrc: string;
    prodPerCapita: number;
    diameter: number;
}
export interface locatedPlanetConfig extends planetConfig {
    location: point;
}

export interface gameConfig {
    planets: planetConfig[];
    starter: planetConfig;
}

export function getConfig(): gameConfig {
    return {
        planets: JSON.parse(fs.readFileSync(__dirname + '/../../config/planets.json').toString()),
        starter: JSON.parse(fs.readFileSync(__dirname + '/../../config/starterplanet.json').toString()),
    };
}