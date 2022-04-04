import { ExtMath, vector } from "../../common/vector";
import { hitboxOwner } from "./hitboxOwner";

export class hitbox {
    public static collides(first: hitboxOwner, second: hitboxOwner): boolean {
        const firstRadius = first.hitbox.radius;
        const secondRadius = second.hitbox.radius;

        let distSqr = first.location.squaredDistance(second.location);
        let minDistSqr = ExtMath.squareSum(firstRadius, secondRadius);

        return distSqr <= minDistSqr;
    }

    public static distance(first: hitboxOwner, second: hitboxOwner) {
        return first.location.distance(second.location) - first.hitbox.radius - second.hitbox.radius;
    }

    public get radius() {
        return this.diameter / 2;
    }
    public set radius(val) {
        this.diameter = val * 2;
    }

    public constructor(
        public diameter: number
    ) { }
}