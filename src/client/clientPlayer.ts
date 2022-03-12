import { movePacketData, newPlayerPacketData } from "../common/packets/server";
import { player } from "../common/player";
import { ExtMath, vector } from "../common/vector";
import { clientController } from "./clientController";
import { resources } from "./resources";
import { transformStack } from "./transformStack";

export class clientPlayer extends player {
    public readonly element: HTMLDivElement;
    public readonly usernameElement: HTMLSpanElement;
    public readonly imageElement: HTMLImageElement;
    private readonly game: clientController;

    public prevLocation: vector;
    public prevDirection: number;

    private get rocketImg(): string {
        return '/static/images/player.png';
    }

    private async drawRocket(canvas: CanvasRenderingContext2D, stack: transformStack, rotation: number) {
        stack.begin();
        stack.rotate(rotation);

        canvas.drawImage(await resources.getImage(this.rocketImg), 0, 0);

        stack.end();
    }
    private drawTitle(canvas: CanvasRenderingContext2D, stack: transformStack) {
        stack.begin();
        stack.translate(new vector(0, 30));

        canvas.fillStyle = '#fff';
        canvas.strokeStyle = '1px solid #000';
        canvas.textAlign = 'center';

        canvas.fillText(this.name, 0, 0);
        canvas.strokeText(this.name, 0, 0);
        
        canvas.fill();
        canvas.stroke();

        stack.end();
    }

    public async draw(canvas: CanvasRenderingContext2D, stack: transformStack, tickDelta: number) {
        stack.begin();

        let lerpedLoc = this.prevLocation.lerp(this.location, tickDelta);
        let lerpedDir = ExtMath.lerp(this.prevDirection, this.direction, tickDelta);

        stack.translate(lerpedLoc);

        await this.drawRocket(canvas, stack, lerpedDir);
        this.drawTitle(canvas, stack);

        stack.end();
    }

    public update(packet: movePacketData) {
        this.direction = packet.newDirection;
        this.location = new vector(packet.newLocation.x, packet.newLocation.y);
        this.updateElement();
    }
    public updateElement() {
        this.element.style.transform = `translate(${this.location.x}px, ${this.location.y}px)`;
        this.usernameElement.style.transform = `rotate(${this.game.direction}deg) translateY(-40px)`;
        this.imageElement.style.transform = `rotate(${this.direction}deg)`;
    }

    public constructor(packet: newPlayerPacketData, controller: clientController) {
        super(packet.name, packet.playerId, new vector(packet.location.x, packet.location.y), packet.direction);

        this.prevDirection = this.direction;
        this.prevLocation = this.location;
        this.game = controller;

        this.imageElement = document.createElement('img');
        this.imageElement.src = '/static/images/player.png';
        this.imageElement.classList.add('movable');
        this.imageElement.draggable = false;

        this.usernameElement = document.createElement('span');
        this.usernameElement.innerText = packet.name;   
        this.usernameElement.classList.add('movable');

        this.element = document.createElement('div');
        this.element.classList.add('player', 'movable');
        this.element.appendChild(this.imageElement);
        this.element.appendChild(this.usernameElement);

        this.updateElement();

        document.getElementById('game')?.appendChild(this.element);
    }
}