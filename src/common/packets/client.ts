/**
 * A packet, requesting a log in. It will expect a
 * INIT packet.
 */
export interface loginPacketData {
    name: string;
}
/**
 * A packet, requesting log off. It has no data, since no
 * data is required for a log off
 */
export type logoutPacketData = undefined;

/**
 * The type of control the player commenced
 */
export enum controlType {
    /**
     * The player went forward (pressed W)
     */
    Forward,
    /**
     * The player steered left (pressed A)
     */
    Left,
    /**
     * The player steered right (pressed D)
     */
    Right,
    /**
     * The player has fired his weapon (pressed Space).
     */
    Fire,
}
/**
 * A packet, that is sent when a client did something with himself
 */
export interface controlPacketData {
    /**
     * Whether or not the action is being activated (true),
     * or deactivated (false)
     */
    starting: boolean;
    /**
     * The type of action being commenced
     */
    type: controlType;
}
/**
 * A packet, that is sent when a client did something with his ship
 */
export interface shipControlPacketData {
    /**
     * Whether or not people were left off the ship (true)
     * or were taken aboard (false).
     */
    leave: boolean;
    /**
     * Amount of people that were taken to/off the ship.
     * This value will get capped appropriately by the server, so
     * any value works here
     */
    count: number;
}
/**
 * A packet, sent whenever the client sent a chat message
 */
export interface clientChatPacketData {
    message: string;
}