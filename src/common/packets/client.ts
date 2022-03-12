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
export interface takePplPacketData {
    count: number;
}
export type leavePplPacketData = takePplPacketData;
