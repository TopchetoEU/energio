import { player } from "../common/player";
import { vector, EPSILON, ExtMath } from "../common/vector";
import { packet, packetConnection } from "../common/packetConnection";
import { serverPlanet } from "./serverPlanet";
import { energyUnit } from "../common/energy";
import { planet } from "../common/planet";
import { Observable, Subscription } from "rxjs";
import { objectChangeTracker, trackableObject } from "../common/props/changes";
import { getNextObjId } from "./server";
import { register } from "../common/props/register";
import { propOwner, trackable } from "../common/props/decorators";
import { gameObjectManager } from "../common/gameObject";
import { physicsController } from "./physics/physicsController";
import { hitbox } from "./physics/hitbox";

export const SPEED = 100;
export const DRAG = -.8;
export const ANGULAR_SPEED = 20;
export const ANGULAR_DRAG = -.9;

export enum rotationDirection {
    LEFT = -1,
    NONE = 0,
    RIGHT = 1,
}

export type packetHandle<T> = (player: serverPlayer, packet: packet<T>) => void;

@trackable()
@propOwner()
export class serverPlayer extends player implements energyUnit, trackableObject, physicsController {
    public name!: string;
    public readonly tracker = new objectChangeTracker(this);
    public readonly connection: packetConnection;
    public readonly mass = 2;
    public moving = false;

    // TODO: unhardcodify
    public readonly linearDrag = .2;
    public readonly angularDrag = .1;
    public readonly hitbox = new hitbox(75);

    private readonly ownedPlanetsChanged!: Observable<register<planet>>;
    private readonly movingChanged!: Observable<boolean>;

    public rotationDirection: rotationDirection = rotationDirection.NONE;

    private _subscribers: { [planet: number]: Subscription } = {};

    public velocity: vector = vector.zero;
    public angularVelocity: number = 0;


    private updatePos(delta: number) {
        // this._angularVelocity += this.rotationDirection * ANGULAR_SPEED;

        // if (this.moving) {
        //     this._velocity = this._velocity.add(vector.fromDirection(this.direction).multiply(SPEED * delta));
        // }

        // if (Math.abs(this._angularVelocity) < EPSILON) this._angularVelocity = 0;
        // else this.direction += this.angularVelocity * delta;

        // if (this._velocity.lengthSquared < EPSILON) this._velocity = vector.zero;
        // else this.location = this.location.add(this.velocity);

        // this._angularVelocity *= ExtMath.drag(ANGULAR_DRAG, delta);
        // this._velocity = this._velocity.drag(DRAG, delta);
        // this.updateSelection();
    }
    private updateSelection() {
        let leastDist = -1;

        let closestPlanet: serverPlanet | undefined;

        // Finds closest planet
        for (let planet of gameObjectManager.getAll(serverPlanet)) {
            let dist = hitbox.distance(planet, this);
            if (leastDist < 0 || dist < leastDist) {
                leastDist = dist;
                closestPlanet = planet as serverPlanet;
            }
        }

        // Deselect if further than 150px
        // TODO: add hitboxes
        if (closestPlanet && leastDist > 150) {
            closestPlanet = undefined;
        }

        this.selectedPlanet = closestPlanet;
    }
    public update(delta: number) {
        if (Math.abs(this.angularVelocity) < EPSILON) this.angularVelocity = 0;
        else this.direction += this.angularVelocity * delta;
        this.angularVelocity *= ExtMath.drag(this.angularDrag - 1, delta);

        if (this.moving) {
            this.velocity = this.velocity.add(vector.fromDirection(this.direction).multiply(SPEED * delta));
        }
        this.angularVelocity += ANGULAR_SPEED * this.rotationDirection;
        this.updateSelection();
    }

    public constructor(name: string, connection: packetConnection, location?: vector, direction?: number) {
        super(getNextObjId(), location, direction);

        this.connection = connection;
        this.name = name;

        // this.ownedPlanets.onAdd.subscribe(v => {
        //     this._subscribers[v.id] = merge(v.productionChanged).subscribe(() => this.updateStats(this.ownedPlanets));
        // });
        // this.ownedPlanets.onRemove.subscribe(v => {
        //     delete this._subscribers[v.id];
        // });

        // this.movingChanged.subscribe(v => {
            // this.actuallyWalking = this.consumption + 1 < this.production;
            // this.updateStats(planetsOwner.planets);
        // });
    }
}