import { planetConfig } from "../../server/gameConfig";
import { point } from "../packets";
import { vector } from "../vector";

export interface syncPosPacketData {
    location: point;
    direction: number;
    pplAboard: number;
}
export interface syncEngPacketData {
    production: number;
    consumption: number;
}
export interface errorPacketData {
    err: string;
    details?: string;
}
export interface initPacketData {
    location: point;
    rotation: number;
    selfId: number;
}

export interface movePacketData {
    playerId: number;
    newLocation: point;
    newDirection: number;
}

export interface newPlayerPacketData {
    playerId: number;
    name: string;
    location: point;
    direction: number;
}
export interface delPlayerPacketData {
    playerId: number;
}

export interface kickPacketData {
    message: string;
}

export type newPlanetPacketData = planetConfig & { id: number };

export interface delPlanetPacketData {
    id: number;
}
export interface ownPlanetPacketData {
    playerId: number;
    planetId: number;
}
export interface disownPlanetPacketData {
    planetId: number;
}
export interface selectPlanetPacketData {
    planetId?: number;
}

export interface syncPlanet {
    planetId: number;
    population: number;
    production: number;
}