import { player } from "../common/player";
import { vector, EPSILON, ExtMath } from "../common/vector";
import { packet, packetConnection } from "../common/packetConnection";
import { serverPlanet } from "./serverPlanet";
import { energyConsumer, energyUnit } from "../common/energy";
import { Observable } from "rxjs";
import { objectChangeTracker, trackableObject } from "../common/props/changes";
import { getNextObjId } from "./server";
import { register } from "../common/props/register";
import { trackable } from "../common/props/decorators";
import { freeFunc, gameObjectBase, gameObjectManager } from "../common/gameObject";
import { physicsController } from "./physics/physicsController";
import { hitbox } from "./physics/hitbox";
import { laserAttribs } from "../common/laser";
import { laserFirer } from "./laserFirer";
import { serverLaser } from "./serverLaser";

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

class basicConsumer extends gameObjectBase implements energyConsumer {
    public readonly optionalConsumer = true;
    public active: boolean = false;

    public get consumption() {
        return this.active ? this._consumption : 0;
    }

    public constructor(private readonly _consumption: number) {
        super(getNextObjId());
    }
}

@trackable()
export class serverPlayer extends player implements energyUnit, trackableObject, physicsController, laserFirer {
    public location: vector;
    public direction: number;
    public production: number = 0;
    public consumption: number = 0;
    public chatBubble: string = '';
    public chatBubbleChanged!: Observable<string>;

    public readonly consumers = new register<energyConsumer>((a, b) => a.id === b.id);
    public readonly workingConsumers = new register<energyConsumer>((a, b) => a.id === b.id);

    public readonly laserAttribs: laserAttribs = {
        decay: .005,
        power: .01,
        size: 5,
        velocity: 1000,
        frequency: 10,
    };
    public name!: string;
    public readonly tracker = new objectChangeTracker(this);
    public readonly connection: packetConnection;
    public readonly mass = 2;
    public get moving() {
        return this.workingConsumers.includes(this.movingConsumer);
    }

    public laserI = 0;

    public readonly movingConsumer = new basicConsumer(.5);
    public readonly shootingConsumer;

    // TODO: unhardcodify
    public readonly linearDrag = .2;
    public readonly angularDrag = .1;
    public readonly hitbox = new hitbox(75);

    public rotationDirection: rotationDirection = rotationDirection.NONE;

    public velocity: vector = vector.zero;
    public angularVelocity: number = 0;

    private updateStats() {
        this.production = this.ownedPlanets.reduce((prev, curr) => prev + curr.production, 0);
        let mandatory = this.consumers.filter(v => !v.optionalConsumer);
        let optional = this.consumers.filter(v => v.optionalConsumer);

        let mandatorySum = mandatory.reduce((prev, curr) => prev + curr.consumption, 0);
        let optionalsSum = 0;
        let selectedOptionals: energyConsumer[] = [];

        for (let consumer of optional) {
            if (consumer.consumption < EPSILON) continue;
            if (consumer.consumption + optionalsSum + mandatorySum < this.production) {
                selectedOptionals.push(consumer);
                optionalsSum += consumer.consumption;
            }
        }

        this.workingConsumers.array = [ ...mandatory, ...selectedOptionals ];
        this.consumption = mandatorySum + optionalsSum;
    }
    private updateSelection() {
        let leastDist = -1;

        let closestPlanet: serverPlanet | undefined;

        // Finds closest planet
        for (let planet of gameObjectManager.getAll(serverPlanet)) {
            let dist = planet.location.distance(this.location) - planet.hitbox.radius;
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

    public update(delta: number, shoot: () => void) {
        this.angularVelocity += ANGULAR_SPEED * this.rotationDirection;
        this.angularVelocity *= ExtMath.drag(this.angularDrag - 1, delta);
        if (Math.abs(this.angularVelocity) < EPSILON) this.angularVelocity = 0;
        else this.direction += this.angularVelocity * delta;

        if (this.moving) {
            this.velocity = this.velocity.add(vector.fromDirection(this.direction).multiply(SPEED));
        }

        this.updateSelection();
        this.updateStats();

        if (this.workingConsumers.includes(this.shootingConsumer)) {
            if (ExtMath.numEquals(this.laserI % ((1 / this.laserAttribs.frequency) / delta), 0)) {
                shoot();
            }
            this.laserI++;
        }

        this.chatTimeout -= delta;
        if (this.chatTimeout < 0) this.chatBubble = '';
    }
    public createLaser(): serverLaser {
        return new serverLaser(getNextObjId(), {
            decay: this.laserAttribs.decay,
            velocity: vector.fromDirection(this.direction).multiply(this.laserAttribs.velocity),
            location: this.location.add(vector.fromDirection(this.direction).multiply(this.hitbox.diameter + 20)),
            power: this.laserAttribs.power,
            size: this.laserAttribs.size,
        });
    }

    public override remove(): void {
        this.connection.close(true);
    }

    chatTimeout = 0;

    public constructor(name: string, connection: packetConnection, location: vector, direction: number, free?: freeFunc<serverPlayer>) {
        super(getNextObjId(), free as freeFunc<player>);
        
        this.connection = connection;
        this.name = name;
        this.location = location;
        this.direction = direction;

        this.shootingConsumer = new basicConsumer(this.laserAttribs.power * this.laserAttribs.frequency);

        this.ownedPlanets.onAdd.subscribe(v => {
            this.consumers.add(v);
        });
        this.ownedPlanets.onRemove.subscribe(v => {
            this.consumers.remove(v);
        });

        this.consumers.add(this.movingConsumer);
        this.consumers.add(this.shootingConsumer);

        this.chatBubbleChanged.subscribe(v => {
            this.chatTimeout = 2;
        });

        // this.movingChanged.subscribe(v => {
            // this.actuallyWalking = this.consumption + 1 < this.production;
            // this.updateStats(planetsOwner.planets);
        // });
    }
}