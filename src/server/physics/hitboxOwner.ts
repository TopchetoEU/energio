import { vector } from "../../common/vector";
import { hitbox } from "./hitbox";

export interface hitboxOwner {
    readonly hitbox: hitbox;
    location: vector;
    onCollision?(other: hitboxOwner): void;
}