import { freeFunc } from "../common/gameObject";
import { planet } from "../common/planet";
import { appliableObject, objectChangeApplier, objectChangeDescriptor } from "../common/props/changes";
import { appliable, constructorExtender } from "../common/props/decorators";
import { vector } from "../common/vector";
import { drawImage } from "./clientController";
import { transformStack } from "./transformStack";
@constructorExtender()
@appliable<clientPlanet>(function(packet: objectChangeDescriptor) {
    this.applier.apply(packet);
})
export class clientPlanet extends planet implements appliableObject {
    public readonly location = vector.zero;
    public readonly renderOffset = vector.zero;
    public readonly productionPerCapita = 0;
    public readonly limit = 0;
    public readonly normalSrc = '';
    public readonly colonySrc = '';
    public readonly selectedSrc = '';
    public readonly name = '';

    public readonly applier = new objectChangeApplier(this);

    public selected: boolean = false;
    
    public readonly production!: number;
    public readonly consumption!: number;

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
        if (this.owner) {
            if (selected) src = this.selectedSrc;
            else src = this.colonySrc;
        }

        stack.begin();

        stack.translate(this.location.subtract(this.renderOffset));
        await drawImage(context, src, false);

        stack.end();
    }

    constructor(packet: objectChangeDescriptor, free?: freeFunc<clientPlanet>) {
        super(packet!.id, free as freeFunc<planet>);
    }
}