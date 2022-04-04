import { laser } from "../common/laser";
import { vector } from "../common/vector";
import { hitbox } from "./physics/hitbox";
import { hitboxOwner } from "./physics/hitboxOwner";
import { physicsController } from "./physics/physicsController";

export class serverLaser extends laser implements physicsController {
    public readonly linearDrag = 0;
    public readonly angularDrag = 0;
    public readonly mass = 0;
    public readonly hitbox = new hitbox(0);

    public onCollision(other: hitboxOwner) {
        console.log(`I hit ${other}`);
    }

    public constructor(id: string, velocity: vector, location: vector) {
        super(id, velocity, location);
    }
}