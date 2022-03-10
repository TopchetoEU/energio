import { player } from "../common/player";
import { vector, EPSILON } from "../common/vector";
import * as ws from "websocket";
import { packet, packetConnection } from "../common/packetConnection";
import { packetCode } from "../common/packets";

export const SPEED = 2;
export const DRAG = .1;
export const ANGULAR_SPEED = 45;
export const ANGULAR_DRAG = .1;

export enum rotationDirection {
    LEFT = -1,
    NONE = 0,
    RIGHT = 1,
}

export type packetHandle<T> = (player: serverPlayer, packet: packet<T>) => void;

export class serverPlayer extends player {
    private _velocity: vector = vector.zero;
    private _angularVelocity: number = 0;
    private _rotationDirection: rotationDirection = rotationDirection.NONE;
    public readonly _connection: packetConnection;

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

    public syncPos() {
        this._connection.sendPacket(packetCode.SYNCPOS, {
            location: this.location,
            direction: this.direction
        });
    }

    public update(delta: number): void {
        if (delta <= EPSILON) return;
    
        this._angularVelocity += this._rotationDirection * ANGULAR_SPEED;

        this._angularVelocity *= 1 - ANGULAR_DRAG * delta;

        if (Math.abs(this._angularVelocity) < EPSILON) this._angularVelocity = 0;
        else this._direction += this.angularVelocity * delta;

        if (this.moving)
            this._velocity = this._velocity.add(vector.fromDirection(this.direction, false).multiply(SPEED * delta));
        this._velocity = this._velocity.drag(DRAG, delta);

        if (this._velocity.lengthSquared < EPSILON) this._velocity = vector.zero;
        else this._location = this._location.add(this.velocity);
    }

    public constructor(name: string, connection: packetConnection) {
        super(name);
        this._connection = connection;
    }
}