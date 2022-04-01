import { planetCreateData } from "../common/packets/server";
import { planet } from "../common/planet";
import { player, playersOwner } from "../common/player";
import { objectChangeApplier, translator } from "../common/props/changeTracker";
import { vector } from "../common/vector";
import { drawImage } from "./clientController";
import { transformStack } from "./transformStack";

export class clientPlanet extends planet {
    public selected: boolean = false;
    public readonly idTranslator: translator<number, player | undefined> = {
        translateFrom: v => v?.id ?? -1,
        translateTo: v => {
            // if (v < 0) return undefined;
            let res = this.playersOwner.players.value.find(_v => _v.id === v);
            if (res) return res;
            else throw new Error("Invalid planet given.");
        },
    };
    public readonly applier = new objectChangeApplier()
        .prop('owner', this.idTranslator)
        .prop('population')
        .prop('production')
        .prop('consumption');

    // public updateElement() {
    //     this.element.style.transform = `translate(${this.location.x}px, ${this.location.y}px)`;

    //     if (this.owner) {
    //         if (this.selected) this.imgElement.src = this.selectedSrc;
    //         else this.imgElement.src = this.colonySrc;
    //     }
    //     else
    //         this.imgElement.src = this.normalSrc;
    // }

    public async draw(selected: boolean, context: CanvasRenderingContext2D, stack: transformStack) {
        let src = this.normalSrc;
        if (this.owner.value) {
            if (selected) src = this.selectedSrc;
            else src = this.colonySrc;
        }

        stack.begin();

        stack.translate(this.location);
        await drawImage(context, src);

        stack.end();
    }

    constructor(playersOwner: playersOwner, packet: planetCreateData) {
        super(playersOwner, 
            packet.id,
            packet.productionPerCapita,
            packet.limit,
            packet.normalSrc, packet.colonySrc, packet.selectedSrc,
            packet.name,
            new vector(packet.location.x, packet.location.y)
        );
        // this.consumption = 
    }
}