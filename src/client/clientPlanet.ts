import { newPlanetPacketData, ownPlanetPacketData, syncPlanet as syncPlanetPacketData } from "../common/packets/server";
import { planet } from "../common/planet";
import { vector } from "../common/vector";

export class clientPlanet extends planet {
    public readonly element: HTMLDivElement;
    public readonly imgElement: HTMLImageElement;
    public selected: boolean = false;
    private _production: number = 0;

    public get production(): number {
        return this._production;
    }

    public updateElement() {
        this.element.style.transform = `translate(${this.location.x}px, ${this.location.y}px)`;

        if (this.owner) {
            if (this.selected) this.imgElement.src = this.selectedSrc;
            else this.imgElement.src = this.colonySrc;
        }
        else
            this.imgElement.src = this.normalSrc;
    }
    public sync(packet: syncPlanetPacketData) {
        this.population = packet.population;
        this._production = packet.production;
        this.updateElement();
    }

    constructor(packet: newPlanetPacketData) {
        super(packet.id, packet.prodPerCapita, packet.limit, packet.normalSrc, packet.colonySrc, packet.selectedSrc, packet.name, new vector(packet.location.x, packet.location.y));

        this.element = document.createElement('div');
        this.element.classList.add('player');
        
        this.imgElement = document.createElement('img');
        this.imgElement.src = packet.colonySrc;
        this.imgElement.draggable = false;

        this.element.appendChild(this.imgElement);

        document.getElementById('background')?.appendChild(this.element);
    }
}