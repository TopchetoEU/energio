export interface point {
    x: number;
    y: number;
}

export type logoffPacketData = undefined;
export interface kickPacketData {
    message: string;
}

export enum packetCode {
    ERROR = -1,
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
}
