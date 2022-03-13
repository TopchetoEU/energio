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
import { objectChangeTracker, trackableObject, translator } from "../common/props/changeTracker";
import { playerCreateData } from "../common/packets/server";

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

export class serverPlayer extends player implements energyUnit, trackableObject {
    public readonly tracker;
    public readonly planetTranslator: translator<planet, number> = {
        translateFrom: v => {
            let res = this.planetOwner.planets.value.find(_v => _v.id === v);
            if (res) return res;
            else throw new Error("Invalid planet given.");
        },
        translateTo: v => v.id,
    };
    public readonly creationData: playerCreateData;

    public readonly connection: packetConnection;

    public rotationDirection: rotationDirection = rotationDirection.NONE;

    private actuallyWalking = false;

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

        if (this.moving.value && this.actuallyWalking) {
            this._velocity = this._velocity.add(vector.fromDirection(this.direction.value).multiply(SPEED * delta));
        }

        if (Math.abs(this._angularVelocity) < EPSILON) this._angularVelocity = 0;
        else this.direction.value += this.angularVelocity * delta;
        
        if (this._velocity.lengthSquared < EPSILON) this._velocity = vector.zero;
        else this.location.value = this.location.value.add(this.velocity);
        
        
        this._angularVelocity *= ExtMath.drag(ANGULAR_DRAG, delta);
        this._velocity = this._velocity.drag(DRAG, delta);
    }
    private updateStats(planets: planet[]) {
        this.production.value = this.ownedPlanets.value.reduce((prev, curr) => prev + curr.production.value, 0);
        this.consumption.value = this.ownedPlanets.value.reduce((prev, curr) => prev + curr.consumption.value, 0) + (this.actuallyWalking ? 1 : 0);
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

        this.ownedPlanets.onChange.subscribe(v => this.updateStats(v));
        this.ownedPlanets.onAdd.subscribe(v => {
            this._subscribers[v.id] = merge(v.production.onChange).subscribe(() => this.updateStats(this.ownedPlanets.value));
        });
        this.ownedPlanets.onRemove.subscribe(v => {
            delete this._subscribers[v.id];
        });
        this.location.onChange.subscribe(v => this.updateSelection(v));
        this.ownedPlanets.onAdd.subscribe(v => v.owner.value = this);
        this.ownedPlanets.onRemove.subscribe(v => v.owner.value = undefined);

        this.creationData = {
            direction: this.direction.value,
            id: this.id,
            location: this.location.value,
            name: name
        }

        this.moving.onChange.subscribe(v => {
            this.actuallyWalking = this.consumption.value + 1 < this.production.value;
            this.updateStats(planetsOwner.planets.value);
        })

        this.tracker = new objectChangeTracker(this)
            .prop('peopleAboard')
            .prop('location', false, vector.pointTranslator)
            .prop('direction')
            .prop('moving')
            .prop('production')
            .prop('consumption');
    }
}