import { point } from "../common/packets";
import { planet } from "../common/planet";
import { player } from "../common/player";
import { appliableObject, objectChangeApplier, objectChangeDescriptor } from "../common/props/changes";
import { afterConstructor, appliable, constructorExtender, propOwner } from "../common/props/decorators";
import { ExtMath, vector } from "../common/vector";
import { drawImage } from "./clientController";
import { transformStack } from "./transformStack";

@constructorExtender()
@appliable()
@propOwner()
export class clientPlayer extends player implements appliableObject {
    public readonly name!: string;
    public readonly applier = new objectChangeApplier(this);
    public prevLocation: vector;
    public prevDirection: number;

    private get rocketImg(): string {
        return 'player.png';
    }

    private async drawRocket(canvas: CanvasRenderingContext2D, stack: transformStack, rotation: number) {
        stack.begin();
        stack.rotate(rotation);

        await drawImage(canvas, this.rocketImg);

        stack.end();
    }
    private drawTitle(canvas: CanvasRenderingContext2D, stack: transformStack, clientRotation: number) {
        stack.rotate(clientRotation);
        stack.translate(new vector(0, -100));

        canvas.fillStyle = '#fff';
        canvas.strokeStyle = '3px solid #000';
        canvas.textAlign = 'center';
        canvas.font = 'bolder 20px';

        canvas.fillText(this.name, 0, 0);
        canvas.strokeText(this.name, 0, 0);
        
        canvas.stroke();
        canvas.fill();
    }

    public async draw(canvas: CanvasRenderingContext2D, stack: transformStack, clientRotation: number, tickDelta: number) {
        stack.begin();

        let lerpedLoc = this.prevLocation.lerp(this.location, tickDelta);
        let lerpedDir = ExtMath.lerp(this.prevDirection, this.direction, tickDelta);

        stack.translate(lerpedLoc);

        await this.drawRocket(canvas, stack, lerpedDir);
        this.drawTitle(canvas, stack, clientRotation);

        stack.end();
    }

    public constructor(packet: objectChangeDescriptor) {
        super(packet.id, vector.fromPoint(packet.location as point), packet.direction);

        this.prevDirection = this.direction;
        this.prevLocation = this.location;
    }

    @afterConstructor()
    private _afterConstr(packet: objectChangeDescriptor) {
        this.applier.apply(packet);
    }
}