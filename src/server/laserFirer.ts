import { laser, laserAttribs } from "../common/laser";
import { serverLaser } from "./serverLaser";

export interface laserFirer {
    readonly laserAttribs: laserAttribs;
    createLaser(): serverLaser;
}