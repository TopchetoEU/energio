import { player } from "../common/player";
import { vector, EPSILON, ExtMath } from "../common/vector";
import { packet, packetConnection } from "../common/packetConnection";
import { packetCode } from "../common/packets";
import { serverPlanet } from "./serverPlanet";

export const SPEED = 50;
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

export class serverPlayer extends player {
    private _velocity: vector = vector.zero;
    private _angularVelocity: number = 0;
    private _rotationDirection: rotationDirection = rotationDirection.NONE;
    private _planets: serverPlanet[] = [];
    protected _consumption: number = 0;
    protected _production: number = 0;
    public readonly _connection: packetConnection;

    public get moving() {
        return this._moving;
    }
    public set moving(val: boolean) {
        this._moving = val;
    }

    public get rotationDirection() {
        return this._rotationDirection;
    }
    public set rotationDirection(val: rotationDirection) {
        this._rotationDirection = val;
    }

    public get velocity() {
        return this._velocity;
    }
    public get angularVelocity() {
        return this._angularVelocity;
    }

    public sync() {
        this._connection.sendPacket(packetCode.SYNCPOS, {
            location: this.location,
            direction: this.direction,
            consumption: this._consumption,
            production: this._production,
        });
    }

    public update(delta: number): void {
        if (delta <= EPSILON) return;
    
        this._angularVelocity += this._rotationDirection * ANGULAR_SPEED;

        if (Math.abs(this._angularVelocity) < EPSILON) this._angularVelocity = 0;
        else this._direction += this.angularVelocity * delta;
        this._angularVelocity *= ExtMath.drag(ANGULAR_DRAG, delta);

        if (this.moving)
            this._velocity = this._velocity.add(vector.fromDirection(this.direction, false).multiply(SPEED * delta));
        this._velocity = this._velocity.drag(DRAG, delta);

        if (this._velocity.lengthSquared < EPSILON) this._velocity = vector.zero;
        else this._location = this._location.add(this.velocity);

        this._planets = this._planets.filter(v => v.peopleCount < 1);
        this._planets.forEach(v => {
            v.update(delta);
        });
    }

    public constructor(name: string, connection: packetConnection) {
        super(name, nextId++);
        this._connection = connection;
    }
}