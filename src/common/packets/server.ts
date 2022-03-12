import { point } from "../packets";

/**
 * A packet that is sent by the server when an error occurs
 */
export interface errorPacketData {
    /**
     * The general human-readable description of the error
     */
    err: string;
    /**
     * A more in-depth explanation of the error
     */
    details?: string;
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

    /**
     * The production rate of the player
     */
    production: number;

    /**
     * The consumption rate of the player
     */
    consumption: number;


    /**
     * The amount of people on the player's spaceship
     */
    pplAboard: number;
}
/**
 * Initialization data for a newly created planet
 */
export interface planetCreateData {
    population: number;
    name: string;
    ownerId?: number | null;

    location: point;
    limit: number;
    prodPerCapita: number;
}

/**
 * Data, used to update a player on the client-side.
 * Sent by the server
 */
export interface playerUpdateData {
    /**
    * The new location for this player. undefined if
    * the location hasn't changed
    */
    location?: point;
    /**
    * The new direction of this player. undefined if
    * it hasn't changed
    */
    direction?: number;

    /**
    * The new production rate of this player. undefined if
    * it hasn't changed
    */
    production?: number;
    /**
    * The new consumption rate of this player. undefined if
    * it hasn't changed
    */
    consumption?: number;

    /**
    * The new amount of people aboard the player's ship. undefined if
    * it hasn't changed
    */
    pplAboard?: number;

    /**
     * An array of all the planet's IDs, that were added to the
     * player's owned planets since last tick
     */
    ownedPlanetIds: number[];
    /**
     * An array of all the planet's IDs, that were removed from the
     * player's owned planets since last tick
     */
    disownedPlanetIds: number[];
}
/**
 * Data, used to update a planet on the client-side.
 * Sent by the server
 */
export interface planetUpdateData {
    /**
     * The new location for this planet. undefined if
     * the location hasn't changed
     */
    location?: point;
    /**
     * The new population for the planet. undefined if
     * it hasn't changed
     */
    population?: number;
    /**
     * The new owner for the planet. undefined if it
     * hasn't changed. -1 if the planet was disowned
     */
    ownerId?: number | -1;
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
    updatedPlayers: { [id: number]: playerUpdateData };
    /**
     * An array, containing all changes, that were made to all
     * visible planets since the last tick
     */
    updatedPlanets: { [id: number]: planetUpdateData };
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
    selectedPlanetId?: number | -1;
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
