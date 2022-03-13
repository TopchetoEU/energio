import { playerCreateData } from "../common/packets/server";
import { planet, planetsOwner } from "../common/planet";
import { player } from "../common/player";
import { objectChangeApplier, translator } from "../common/props/changeTracker";
import { ExtMath, vector } from "../common/vector";
import { clientController, drawImage } from "./clientController";
import { resources } from "./resources";
import { transformStack } from "./transformStack";

export class clientPlayer extends player {
    public prevLocation: vector;
    public prevDirection: number;

    public readonly planetTranslator: translator<number, planet> = {
        translateFrom: v => v.id,
        translateTo: v => {
            let res = this.planetOwner.planets.value.find(_v => _v.id === v);
            if (res) return res;
            else throw new Error("Invalid planet given.");
        },
    };

    public readonly applier = new objectChangeApplier()
        // .prop('ownedPlanets', true, this.planetTranslator)
        .prop('peopleAboard')
        .prop('location', false, vector.pointTranslator)
        .prop('direction')
        .prop('moving')
        .prop('production')
        .prop('consumption');

    private get rocketImg(): string {
        return '/static/images/player.png';
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
        canvas.font = 'bolder'

        canvas.fillText(this.name, 0, 0);
        // canvas.strokeText(this.name, 0, 0);
        
        // canvas.stroke();
        canvas.fill();
    }

    public async draw(canvas: CanvasRenderingContext2D, stack: transformStack, clientRotation: number, tickDelta: number) {
        stack.begin();

        let lerpedLoc = this.prevLocation.lerp(this.location.value, tickDelta);
        let lerpedDir = ExtMath.lerp(this.prevDirection, this.direction.value, tickDelta);

        stack.translate(lerpedLoc);

        await this.drawRocket(canvas, stack, lerpedDir);
        this.drawTitle(canvas, stack, clientRotation);

        stack.end();
    }

    public constructor(planetOwner: planetsOwner, packet: playerCreateData) {
        super(planetOwner, packet.name, packet.id, vector.fromPoint(packet.location), packet.direction);

        this.prevDirection = this.direction.value;
        this.prevLocation = this.location.value;
    }
}