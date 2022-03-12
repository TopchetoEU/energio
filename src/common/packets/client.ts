export interface loginPacketData {
    name: string;
}

export enum controlType {
    Forward,
    Left,
    Right,
}
/**
 * A packet, that is sent when a client did something with himself
 */
export interface controlPacketData {
    starting: boolean;
    type: controlType;
}
/**
 * A packet, that is sent when a client did something with his ship
 */
export interface shipControlPacketData {
    leave: boolean;
    count: number;
}
