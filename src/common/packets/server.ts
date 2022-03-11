import { point } from "../packets";

export interface syncPosPacketData {
    location: point;
    direction: number;
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
