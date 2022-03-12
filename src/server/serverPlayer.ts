import { player } from "../common/player";
import { vector, EPSILON, ExtMath } from "../common/vector";
import { packet, packetConnection } from "../common/packetConnection";
import { packetCode } from "../common/packets";
import { serverPlanet } from "./serverPlanet";
import { energyUnit } from "./energy";
import { serverController } from "./serverController";

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
    private _velocity: vector = vector.zero;
    private _angularVelocity: number = 0;
    private _rotationDirection: rotationDirection = rotationDirection.NONE;
    protected _consumption: number = 0;
    protected _production: number = 0;
    public readonly _connection: packetConnection;

    public get balance(): number {
        return this.production - this.consumption;
    }
    public get production(): number {
        return this._production;
    }
    public get consumption(): number {
        return this._consumption;
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
        });
        this._connection.sendPacket(packetCode.SYNCENG, {
            consumption: this._consumption,
            production: this.production,
        });
    }

    public async update(delta: number, controller: serverController): Promise<void> {
        if (delta <= EPSILON) return;
    
        this._angularVelocity += this._rotationDirection * ANGULAR_SPEED;

        if (Math.abs(this._angularVelocity) < EPSILON) this._angularVelocity = 0;
        else this.direction += this.angularVelocity * delta;
        this._angularVelocity *= ExtMath.drag(ANGULAR_DRAG, delta);

        if (this.moving)
            this._velocity = this._velocity.add(vector.fromDirection(this.direction, false).multiply(SPEED * delta));
        this._velocity = this._velocity.drag(DRAG, delta);

        if (this._velocity.lengthSquared < EPSILON) this._velocity = vector.zero;
        else this.location = this.location.add(this.velocity);

        for (let planet of this.ownedPlanets.filter(v => v.population < 1)) {
            await controller.disownPlanet(planet as serverPlanet);
        }
        this.ownedPlanets.forEach(v => {
            (v as serverPlanet).update(delta);
        });
        this._production = this.ownedPlanets.reduce((prev, curr) => prev + curr.production, 0) / 1000;
        this._consumption = this.ownedPlanets.reduce((prev, curr) => prev + curr.consumption, 0) / 1000;
    }

    public constructor(name: string, connection: packetConnection, location?: vector, direction?: number) {
        super(name, nextId++, location, direction);
        this._connection = connection;
    }
}