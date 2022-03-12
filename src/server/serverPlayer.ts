import { player } from "../common/player";
import { vector, EPSILON, ExtMath } from "../common/vector";
import { packet, packetConnection } from "../common/packetConnection";
import { packetCode } from "../common/packets";
import { serverPlanet } from "./serverPlanet";
import { energyUnit } from "../common/energy";
import { serverController } from "./serverController";
import { HighlightSpanKind } from "typescript";
import { property } from "../common/props/property";
import { planet, planetsOwner } from "../common/planet";
import { merge, Subscriber, Subscription } from "rxjs";

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

let nextId = 1;

export class serverPlayer extends player implements energyUnit {
    public readonly connection: packetConnection;

    public rotationDirection: rotationDirection = rotationDirection.NONE;

    private _velocity: vector = vector.zero;
    private _angularVelocity: number = 0;
    private _subscribers: { [planet: number]: Subscription } = {};

    public get velocity() {
        return this._velocity;
    }
    public get angularVelocity() {
        return this._angularVelocity;
    }

    private updatePos(delta: number) {
        this._angularVelocity += this.rotationDirection * ANGULAR_SPEED;

        this.tryConsume(1, () => {
            this._velocity = this._velocity.add(vector.fromDirection(this.direction.value).multiply(SPEED * delta));
        });
    
        if (Math.abs(this._angularVelocity) < EPSILON) this._angularVelocity = 0;
        else this.direction.value += this.angularVelocity * delta;
        this._angularVelocity *= ExtMath.drag(ANGULAR_DRAG, delta);
        this._velocity = this._velocity.drag(DRAG, delta);

        if (this._velocity.lengthSquared < EPSILON) this._velocity = vector.zero;
        else this.location.value = this.location.value.add(this.velocity);
    }
    private updateStats(planets: planet[]) {
        this.production.value = planets.reduce((prev, curr) => prev + curr.production.value, 0);
        this.consumption.value = planets.reduce((prev, curr) => prev + curr.consumption.value, 0);
    }
    private updateSelection(location: vector) {
        let leastDist = -1;

        let closestPlanet: serverPlanet | undefined;

        // Finds closest planet
        for (let planet of this.planetOwner.planets.value) {
            let dist = planet.location.squaredDistance(this.location.value);
            if (leastDist < 0 || dist < leastDist) {
                leastDist = dist;
                closestPlanet = planet as serverPlanet;
            }
        }

        // Deselect if further than 150px
        if (closestPlanet && leastDist > 150 * 150) {
            closestPlanet = undefined;
        }

        this.selectedPlanet.value = closestPlanet;
    }

    public update(delta: number) {
        if (delta <= EPSILON) return;

        this.updatePos(delta);
    }

    public constructor(planetsOwner: planetsOwner, name: string, connection: packetConnection, location?: vector, direction?: number) {
        super(planetsOwner, name, nextId++, location, direction);
        this.connection = connection;

        this.ownedPlanets.onChange.subscribe(this.updateStats);
        this.ownedPlanets.onAdd.subscribe(v => {
            this._subscribers[v.id] = merge(v.consumption.onChange, v.production.onChange).subscribe(() => this.updateStats(this.ownedPlanets.value));
        });
        this.ownedPlanets.onRemove.subscribe(v => {
            delete this._subscribers[v.id];
        });
        this.location.onChange.subscribe(this.updateSelection);
    }
}