import { movePacketData, newPlayerPacketData } from "../common/packets/server";
import { player } from "../common/player";
import { vector } from "../common/vector";

export class clientPlayer extends player {
    public readonly element: HTMLElement;

    public update(packet: movePacketData) {
        this._direction = packet.newDirection;
        this._location = new vector(packet.newLocation.x, packet.newLocation.y);
    }
    public updateElement() {
        this.element.style.transform = `translate(${this.location.x}px, ${this.location.y}px) rotate(${this.direction}deg)`;
    }

    public constructor(packet: newPlayerPacketData) {
        super(packet.name, packet.playerId, new vector(packet.location.x, packet.location.y), packet.direction);

        const img = document.createElement('img');
        img.src = '/static/image/rocket-1.png';

        this.element = document.createElement('div');
        this.element.classList.add('player', 'movable');
        this.element.appendChild(img);

        this.updateElement();

        document.getElementById('game')?.appendChild(this.element);
    }
}