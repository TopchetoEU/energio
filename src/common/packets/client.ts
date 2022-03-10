export interface loginPacketData {
    name: string;
}

export enum controlType {
    Forward,
    Left,
    Right,
}
export interface controlPacketData {
    starting: boolean;
    type: controlType;
}
