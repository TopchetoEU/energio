import { Observable, Subject } from "rxjs";
import { healthOwner } from "../common/healthOwner";
import { laser, laserCreationData } from "../common/laser";
import { vector } from "../common/vector";
import { hitbox } from "./physics/hitbox";
import { hitboxOwner } from "./physics/hitboxOwner";
import { physicsController } from "./physics/physicsController";

export class serverLaser extends laser implements physicsController {
    public readonly linearDrag = 1;
    public readonly angularDrag = 1;
    public readonly mass = 0;
    public readonly hitbox: hitbox;
    private _onHit = new Subject<hitboxOwner>();

    public get onHit(): Observable<hitboxOwner> {
        return this._onHit;
    }

    public onCollision(other: hitboxOwner) {
        if (typeof (other as unknown as healthOwner).health === 'number') {
            let ho = other as unknown as healthOwner;
            ho.health -= this.power;
        }
        this.velocity = vector.zero;
        this._onHit.next(other);
        this._onHit.complete();
    }

    public constructor(id: string, creationData: laserCreationData) {
        super(id, vector.fromPoint(creationData.velocity), vector.fromPoint(creationData.location), creationData.size, creationData.decay, creationData.power);
        this.hitbox = new hitbox(this.size);
    }
}