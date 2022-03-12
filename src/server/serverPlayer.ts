import { player } from "../common/player";
import { vector, EPSILON, ExtMath } from "../common/vector";
import { packet, packetConnection } from "../common/packetConnection";
import { packetCode } from "../common/packets";
import { serverPlanet } from "./serverPlanet";
import { energyUnit } from "./energy";
import { serverController } from "./serverController";
import { HighlightSpanKind } from "typescript";
import { property } from "../common/props/property";

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
    public velocity: property()

    private _velocity: vector = vector.zero;
    private _angularVelocity: number = 0;
    private _rotationDirection: rotationDirection = rotationDirection.NONE;
    public _selectedPlanet?: serverPlanet;
    protected _consumption: number = 0;
    protected _production: number = 0;
    public readonly connection: packetConnection;

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

    public sync(planets: serverPlanet[]) {
        this.connection.sendPacket(packetCode.SYNCPOS, {
            location: this.location,
            direction: this.direction,
            pplAboard: this.peopleAboard,
        });
        this.connection.sendPacket(packetCode.SYNCENG, {
            consumption: this._consumption,
            production: this.production,
        });

        let leastDist = -1;
        let closestPlanet: serverPlanet | undefined;

        // Finds closest planet
        for (let planet of planets) {
            let dist = planet.location.squaredDistance(this.location);
            if (leastDist < 0 || dist < leastDist) {
                leastDist = dist;
                closestPlanet = planet as serverPlanet;
            }
        }

        // Deselect if further than 150px
        if (closestPlanet && leastDist > 150 * 150) {
            closestPlanet = undefined;
        }

        // Don't update if same planet is being reselected
        if (this._selectedPlanet !== closestPlanet) {
            if (closestPlanet) {
                this.connection.sendPacket(packetCode.SELECTPLANET, {
                    planetId: closestPlanet.id,
                });
            }
            else  {
                this.connection.sendPacket(packetCode.SELECTPLANET, {});
            }
        }
        this._selectedPlanet = closestPlanet;
    }

    public async update(delta: number, controller: serverController): Promise<void> {
        if (delta <= EPSILON) return;
    
        this._angularVelocity += this._rotationDirection * ANGULAR_SPEED;

        this._production = this.ownedPlanets.reduce((prev, curr) => prev + curr.production, 0);
        this._consumption = this.ownedPlanets.reduce((prev, curr) => prev + curr.consumption, 0);

        let move = true;

        if (this.moving) {
            this._consumption += 1;
            if (this._consumption > this.production) {
                move = false;
                this._consumption -= 1;
            }
        }
    
        if (Math.abs(this._angularVelocity) < EPSILON) this._angularVelocity = 0;
        else this.direction += this.angularVelocity * delta;
        this._angularVelocity *= ExtMath.drag(ANGULAR_DRAG, delta);

        if (this.moving && move)
            this._velocity = this._velocity.add(vector.fromDirection(this.direction, false).multiply(SPEED * delta));
        this._velocity = this._velocity.drag(DRAG, delta);

        if (this._velocity.lengthSquared < EPSILON) this._velocity = vector.zero;
        else this.location = this.location.add(this.velocity);

        for (let planet of this.ownedPlanets.filter(v => v.population < 0.001)) {
            await controller.disownPlanet(planet as serverPlanet);
        }
        this.ownedPlanets.forEach(v => {
            (v as serverPlanet).update(delta);
        });
    }

    public constructor(name: string, connection: packetConnection, location?: vector, direction?: number) {
        super(name, nextId++, location, direction);
        this.connection = connection;
    }
}