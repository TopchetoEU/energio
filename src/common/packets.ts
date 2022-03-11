export interface point {
    x: number;
    y: number;
}

export type logoffPacketData = undefined;

export enum packetCode {
    NONE = 0,
    LOGIN,
    LOGOFF,
    KICK,
    INIT,
    CONTROL,
    MOVE,
    SYNCPOS,
    NEWPLAYER,
    DELPLAYER,
    NEWPLANET,
    DELPLANET,
}
