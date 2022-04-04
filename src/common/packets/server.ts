import { point } from "../packets";
import { objectChangeDescriptor } from "../props/changes";
import { NIL } from "uuid";

/**
 * An enum of all possible kick reasons
 */
export enum kickReason {
    Generic,
    ServerStopped,
    Died,
    AdminKick,
}

// /**
//  * Initialization data for a newly created player
//  */
// export interface playerCreateData {
//     /**
//      * The location of the player
//      */
//     location: point;
//     /**
//      * The direction of the player
//      */
//     direction: number;
//     /**
//      * The name of the player
//      */
//     name: string;
//     /**
//      * The id of the player
//      */
//     id: string;
// }
// /**
//  * Initialization data for a newly created planet
//  */
// export interface planetCreateData {
//     id: string;
//     name: string;
//     limit: number;

//     normalSrc: string;
//     colonySrc: string;
//     selectedSrc: string;

//     productionPerCapita: number;

//     location: point;
// }

/**
 * Data, used to update a player on the client-side.
 * Sent by the server
 */
export interface playerUpdateData {
    id: string;
    changes: objectChangeDescriptor;
}
/**
 * Data, used to update a planet on the client-side.
 * Sent by the server
 */
export interface planetUpdateData {
    id: string;
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
    updatedPlayers?: playerUpdateData[];
    /**
     * An array, containing all changes, that were made to all
     * visible planets since the last tick
     */
    updatedPlanets?: planetUpdateData[];
    /**
     * An array, containing initialization data for all
     * players, that were created since the last tick, or
     * entered view distance
     */
    newPlayers?: objectChangeDescriptor[];
    /**
     * An array, containing initialization data for all
     * planets, that were created since the last tick, or
     * entered view distance
     */
    newPlanets?: objectChangeDescriptor[];
    /**
     * An array, containing the IDs of all players, that
     * were removed since the last tick, or exited view
     * distance
     */
    deletedPlayers?: string[];
    /**
     * An array, containing the IDs of all planets, that
     * were removed since the last tick, or exited view
     * distance
     */
    deletedPlanets?: string[];
    /**
     * The id of the currently selected planet (closest planet to
     * the player). If none, it will be -1
     */
    selectedPlanetId?: string | typeof NIL;
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
    selfId: string;
}


/**
 * A subset of the effectPacketData, sent by the server,
 * whenever a laser effect is being played. Only this effect
 * may get ended and the client must draw these
 */
export interface laserPacketData {
    /**
     * The type of the effect. In this case, a laser
     */
    type: 'laser';
    /**
     * The id of the laser
     */
    id: string;
    /**
     * The location at which the laser was shot
     */
    location: point;
    /**
     * The velocity of the laser
     */
    velocity: point;
    /**
     * The size (width, in pixels) of the laser
     */
    size: number;
    /**
     * The color of the laser
     */
    color: { r: number, g: number, b: number }
    /**
     * The decay (per second, gigawatts) of the laser.
     * If the power of the laser reaches 0, the laser will automatically be destroyed
     */
    decay: number;
    /**
     * The power (gigawatts) of the laser
     */
    power: number;
}
/**
 * A subset of the effectPacketData, sent by the server,
 * whenever particle effects should be played. The client
 * may not draw these, for performance reasons
 */
export enum particleType {
    Fuel,
    WeaponCharge,
    ShipsBump,
    LaserHit,
}
export interface particlePacketData {
    /**
     * The type of the effect. In this case, a particle
     */
    type: 'particle';
    /**
     * The id of the particle
     */
    id: string;
    /**
     * The location at which the particles were created
     */
    location: point;
    /**
     * The type of the particle
     */
    particleType: particleType;
    /**
     * The size of the area in which the particles will be spawned
     */
    size: number;
}

/**
 * A packet sent by the server when an effect should
 * be played
 */
export type effectPacketData = particlePacketData | laserPacketData;

/**
 * A packet sent by the client when an effect should
 * be stopped and freed
 */
export interface stopEffectPacketData {
    id: string;
}