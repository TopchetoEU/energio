import { newPlanetPacketData, ownPlanetPacketData } from "../common/packets/server";
import { planet } from "../common/planet";
import { player } from "../common/player";
import { vector } from "../common/vector";
import { clientPlayer } from "./clientPlayer";

export class clientPlanet extends planet {
    public readonly element: HTMLDivElement;
    public readonly imgElement: HTMLImageElement;

    public get production(): number {
        return 0;
    }

    public updateElement() {
        this.element.style.transform = `translate(${this.location.x}px, ${this.location.y}px)`;
        console.log(this.colonySrc);
        if (this.owner)
            this.imgElement.src = this.colonySrc;
        else
            this.imgElement.src = this.normalSrc;
    }

    constructor(packet: newPlanetPacketData) {
        super(packet.id, packet.prodPerCapita, packet.limit, packet.normalSrc, packet.colonySrc, packet.selectedSrc, new vector(packet.location.x, packet.location.y));

        this.element = document.createElement('div');
        this.element.classList.add('player');
        
        this.imgElement = document.createElement('img');
        this.imgElement.src = packet.colonySrc;

        this.element.appendChild(this.imgElement);

        document.getElementById('background')?.appendChild(this.element);
    }
}