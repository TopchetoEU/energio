import { laser } from "../common/laser";
import { transformStack } from "./transformStack";

export class clientLaser extends laser {
    public override update(delta: number) {
        this.location = this.location.add(this.velocity.multiply(delta));
        super.update(delta);
    }

    public draw(context: CanvasRenderingContext2D, stack: transformStack) {
        stack.begin();
        stack.translate(this.location);
        stack.rotate(this.velocity.toDirection());

        context.beginPath();
        context.rect(-this.size / 2, -this.size / 2, this.size, 100);

        context.fillStyle = "yellow";
        context.fill();

        stack.end();
    }
}