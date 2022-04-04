import { hitbox } from "../server/physics/hitbox";
import { physicsController } from "../server/physics/physicsController";
import { gameObject } from "./gameObject";
import { vector } from "./vector";

export class laser extends gameObject {
    public constructor(
        id: string,
        public velocity: vector,
        public location: vector
    ) {
        super(id);
    }
}