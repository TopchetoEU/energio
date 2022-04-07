import { point } from "../common/packets";
import * as fs from "fs";
import { assetData } from "../common/packets/server";

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
    assets: assetData[];
}

export function getConfig(): gameConfig {
    return {
        planets: JSON.parse(fs.readFileSync(__dirname + '/../../config/planets.json').toString()),
        starter: JSON.parse(fs.readFileSync(__dirname + '/../../config/starterplanet.json').toString()),
        assets: JSON.parse(fs.readFileSync(__dirname + '/../../config/assets.json').toString()),
    };
}