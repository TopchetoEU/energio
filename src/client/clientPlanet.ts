import { point } from "../common/packets";
import { planet } from "../common/planet";
import { playersOwner } from "../common/player";
import { appliableObject, objectChangeApplier, objectChangeDescriptor } from "../common/props/changes";
import { afterConstructor, appliable, constructorExtender, propOwner } from "../common/props/decorators";
import { vector } from "../common/vector";
import { drawImage } from "./clientController";
import { transformStack } from "./transformStack";
@constructorExtender()
@appliable()
@propOwner()
export class clientPlanet extends planet implements appliableObject {
    public readonly renderOffset!: vector;
    public readonly productionPerCapita!: number;
    public readonly limit!: number;
    public readonly normalSrc!: string;
    public readonly colonySrc!: string;
    public readonly selectedSrc!: string;
    public readonly name!: string;

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

    constructor(packet: objectChangeDescriptor) {
        super(packet.id, vector.fromPoint(packet.location as point));
    }

    @afterConstructor()
    private _afterConstr(packet: objectChangeDescriptor) {
        this.applier.apply(packet);
    }
}