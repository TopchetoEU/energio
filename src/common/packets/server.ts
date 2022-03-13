import { point } from "../packets";
import { objectChangeDescriptor } from "../props/changeTracker";


/**
 * An enum of all possible kick reasons
 */
export enum kickReason {
    Generic,
    ServerStopped,
    Died,
    AdminKick,
}

/**
 * Initialization data for a newly created player
 */
export interface playerCreateData {
    /**
     * The location of the player
     */
    location: point;
    /**
     * The direction of the player
     */
    direction: number;
    /**
     * The name of the player
     */
    name: string;
    /**
     * The id of the player
     */
    id: number;
}
/**
 * Initialization data for a newly created planet
 */
export interface planetCreateData {
    id: number;
    name: string;
    limit: number;

    normalSrc: string;
    colonySrc: string;
    selectedSrc: string;

    productionPerCapita: number;

    location: point;
}

/**
 * Data, used to update a player on the client-side.
 * Sent by the server
 */
export interface playerUpdateData {
    id: number;
    changes: objectChangeDescriptor;
}
/**
 * Data, used to update a planet on the client-side.
 * Sent by the server
 */
export interface planetUpdateData {
    id: number;
    changes: objectChangeDescriptor;
}


/**
 * A packet, sent by the server each tick. It contains changes in
 * the game's state since the last tick. This is the first packet
 * that a player receives
 */
export interface tickPacketData {
    /**
     * An array, containing all changes, that were made to all
     * visible players since the last tick
     */
    updatedPlayers: playerUpdateData[];
    /**
     * An array, containing all changes, that were made to all
     * visible planets since the last tick
     */
    updatedPlanets: planetUpdateData[];
    /**
     * An array, containing initialization data for all
     * players, that were created since the last tick, or
     * entered view distance
     */
    newPlayers: playerCreateData[];
    /**
     * An array, containing initialization data for all
     * planets, that were created since the last tick, or
     * entered view distance
     */
    newPlanets: planetCreateData[];
    /**
     * An array, containing the IDs of all players, that
     * were removed since the last tick, or exited view
     * distance
     */
    deletedPlayers: number[];
    /**
     * An array, containing the IDs of all planets, that
     * were removed since the last tick, or exited view
     * distance
     */
    deletedPlanets: number[];
    /**
     * The id of the currently selected planet (closest planet to
     * the player). If none, it will be -1
     */
    selectedPlanetId: number | -1;
    /**
     * The time elapsed since last tick (generally the length of
     * the tick, but there might be variation depending on the
     * server load)
     */
    delta: number;
}

/**
 * A packet, sent by the server, indicating the
 * kicking if the player
 */
export interface kickPacketData {
    /**
     * The reason for kicking
     */
    reason: kickReason;
    /**
     * The message for the kicking.
     * undefined if no reason was specified
     */
    message?: string;
}

/**
 * A packet, sent by the server as a response to
 * a login request
 */
 export interface initPacketData {
    /**
     * The ID with which the client's player will be identified
     */
    selfId: number;
}