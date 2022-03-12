import { transform } from "typescript";
import { vector } from "../common/vector";

interface transformation {
    undo(context: CanvasRenderingContext2D): void;
    apply(context: CanvasRenderingContext2D): void;
}

class translation implements transformation {
    undo(context: CanvasRenderingContext2D): void {
        context.translate(-this.x, -this.y);
    }
    apply(context: CanvasRenderingContext2D): void {
        context.translate(this.x, this.y);
    }

    public constructor(
        public readonly x: number,
        public readonly y: number
    ) {}
}
class rotation implements transformation {
    undo(context: CanvasRenderingContext2D): void {
        context.rotate(-this.angle);
    }
    apply(context: CanvasRenderingContext2D): void {
        context.rotate(this.angle);
    }

    public constructor(
        public readonly angle: number
    ) {}
}

export class transformStack {
    // The transformations that were applied, in order
    private transStack: transformation[] = [];
    private countStack: number[] = [];

    /**
     * Pushes a transformation, applies it and increases the last number in countStack
     */
    private pushTransformation(transform: transformation) {
        if (this.countStack.length === 0) throw new Error("begin() must be called before any transformations are applied");
        this.transStack.push(transform);
        transform.apply(this.context);
        this.countStack[this.countStack.length - 1]++;
    }
    /**
     * Pops a transformation and undoes it
     */
    private popTransformation() {
        let transform = this.transStack.pop();
        if (transform) {
            transform.undo(this.context);
        }
    }

    /**
     * Begin a series of transformations.
     */
    public begin() {
        this.countStack.push(0);
    }
    /**
     * Begin a series of transformations.
     */
    public end() {
        if (this.countStack.length === 0) throw new Error("end() may not be called before a begin() call.");
        let n = this.countStack.pop() as number;
        
        for (let i = 0; i < n; i++) {
            this.popTransformation();
        }
    }


    /**
     * Translates the matrix by the specified amount
     * Note that this can't be used before a begin() call
     * @param offset Offset to translate with
     */
    public translate(offset: vector) {
        this.pushTransformation(new translation(offset.x, offset.y));
    }
    /**
     * Translates the matrix by the specified amount
     * Note that this can't be used before a begin() call
     * @param offset Offset to translate with
     */
    public rotate(angle: number, inRadians: boolean = false) {
        if (!inRadians) angle = angle * Math.PI / 180;
        this.pushTransformation(new rotation(angle));
    }

    /**
     * Creates a transform stack. This is used so that a function can more
     * easily clean up transformations after itself.
     * @param context The context to apply transformations to
     */
    constructor (private context: CanvasRenderingContext2D) {

    }
}