import { vector } from "../../common/vector";
import { hitboxOwner } from "./hitboxOwner";

export interface physicsController extends hitboxOwner {
    velocity: vector;
    readonly linearDrag: number;
    readonly mass: number;
}
