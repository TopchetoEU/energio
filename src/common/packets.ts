export interface point {
    x: number;
    y: number;
}

export enum packetCode {
    NONE = 0,
    LOGIN,
    LOGOFF,
    KICK,
    INIT,
    CONTROL,
    SHIPCONTROL,
    TICK,
    EFFECT,
    ENDEFFECT,
    CHAT,
    ACKNASSETS,
}
