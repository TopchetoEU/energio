import { movePacketData, newPlayerPacketData } from "../common/packets/server";
import { player } from "../common/player";
import { vector } from "../common/vector";
import { clientController } from "./clientController";

export class clientPlayer extends player {
    public readonly element: HTMLDivElement;
    public readonly usernameElement: HTMLSpanElement;
    public readonly imageElement: HTMLImageElement;
    private readonly game: clientController;

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

        this.game = controller;

        this.imageElement = document.createElement('img');
        this.imageElement.src = '/static/images/player.png';
        this.imageElement.classList.add('movable');

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