import { Observable, Subject } from "rxjs";
import { register } from "../../common/props/register";
import { EPSILON, vector } from "../../common/vector";
import { hitbox } from "./hitbox";
import { hitboxOwner } from "./hitboxOwner";
import { physicsController } from "./physicsController";

export interface collisionEvent {
    readonly thisA: hitboxOwner;
    readonly otherB: hitboxOwner;
}

interface bouncable extends hitboxOwner {
    readonly velocity: vector;
    readonly mass: number;
}
interface bounceResult {
    velocityA: vector;
    velocityB: vector;
}

export class physicsEngine {
    public readonly objects = new register<hitboxOwner | physicsController>();
    private _collision = new Subject<collisionEvent>();
    public readonly step: number = 1;

    /**
     * Serj Tankian's favourite
     * Taken from https://stackoverflow.com/a/9455734
     */
    private bounce(a: bouncable, b: bouncable): bounceResult {
        if (a.mass < EPSILON || b.mass < EPSILON) return {
            velocityA: a.velocity,
            velocityB: b.velocity,
        }

        var dt, mT, v1, v2, cr, sm,
            dn = a.location.subtract(b.location),
            sr = a.hitbox.radius + b.hitbox.radius, // sum of radii
            dx = dn.length; // pre-normalized magnitude

        // sum the masses, normalize the collision vector and get its tangential
        sm = a.mass + b.mass;
        dn = dn.normalized;
        dt = new vector(dn.y, -dn.x);

        // avoid double collisions by "un-deforming" balls (larger mass == less tx)
        // this is susceptible to rounding errors, "jiggle" behavior and anti-gravity
        // suspension of the object get into a strange state
        mT = dn.multiply(a.hitbox.radius + b.hitbox.radius - dx);
        a.location = a.location.add(mT.multiply(b.mass / sm));
        b.location = b.location.add(mT.multiply(-a.mass / sm));

        // cache the magnitude of the applicable component of the relevant velocity
        v1 = dn.multiply(a.velocity.dot(dn)).length;
        v2 = dn.multiply(b.velocity.dot(dn)).length; 

        // maintain the unapplicatble component of the relevant velocity
        // then apply the formula for inelastic collisions
        let velA = dt.multiply(a.velocity.dot(dt)).subtract(dn.multiply((b.mass * (v2 - v1) + a.mass * v1 + b.mass * v2) / sm));

        // do this once for each object, since we are assuming collide will be called 
        // only once per "frame" and its also more effiecient for calculation cacheing 
        // purposes
        let velB = dt.multiply(b.velocity.dot(dt)).subtract(dn.multiply((a.mass * (v1 - v2) + b.mass * v2 + a.mass * v1) / sm));

        return { velocityA: velA, velocityB: velB };
    }
    private move(direction: vector, stepLength: number, length: number, controller: physicsController) {
        let testHitbox: hitboxOwner = {
            location: controller.location,
            hitbox: controller.hitbox,
        };

        direction = direction.normalized;

        while (length > 0) {
            let stepLen = Math.min(length, stepLength);
            let step = direction.multiply(stepLen);

            testHitbox.location = testHitbox.location.add(step);

            let colliders = this.colliders(testHitbox, controller);

            if (colliders.length > 0) {
                controller.location = testHitbox.location;

                for (let collider of colliders) {
                    if ((collider as physicsController).velocity !== void 0) {
                        let otherController = collider as physicsController;

                        let res = this.bounce(controller, otherController);

                        controller.velocity = res.velocityA;
                        otherController.velocity = res.velocityB;

                        if (otherController.onCollision) otherController.onCollision(controller);
                    }
                    else {
                        controller.velocity = this.bounce(controller, {
                            hitbox: collider.hitbox,
                            location: collider.location,
                            mass: 10000000,
                            velocity: vector.zero,
                        }).velocityA;
                    }

                    if (controller.onCollision) controller.onCollision(collider);
                }

                return;
            }

            length -= stepLen;
        }

        controller.location = testHitbox.location;
    }

    private colliders(collider: hitboxOwner, actualCollider: hitboxOwner | physicsController = collider) {
        return this.objects.filter(v => v !== actualCollider && hitbox.collides(collider, v));
    }

    private updateController(delta: number, controller: physicsController) {
        if (controller.velocity.lengthSquared < EPSILON) controller.velocity = vector.zero;
        else this.move(controller.velocity, this.step, controller.velocity.length * delta, controller);

        controller.velocity = controller.velocity.drag(controller.linearDrag - 1, delta);
    }

    public update(delta: number) {
        this.objects.forEach(v => {
            if ((v as physicsController).velocity) this.updateController(delta, v as physicsController);
        });
    }

    /**
     * Emits twice for each object configuration.
     * Has affinity to deleting objects
     */
    public onCollision(obj?: hitboxOwner): Observable<collisionEvent> {
        return this._collision;
    }

    public constructor() {
    }
}