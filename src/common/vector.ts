export const EPSILON = 0.0001;

export const ExtMath = {
    drag(drag: number, delta: number) {
        return Math.pow(1 + drag, delta);
    },
    numEquals(a: number, b: number) {
        const diff = a - b;
        return diff > -EPSILON && diff < EPSILON;
    }
}

export class vector {
    public static get zero() {
        return new vector(0, 0);
    }

    public readonly x: number;
    public readonly y: number;

    public add(vec: vector): vector;
    public add(x: number, y: number): vector;
    public add(x: number | vector, y?: number): vector {
        if (typeof x == 'number') {
            if (typeof y != 'number') throw new Error("y must be a number if x is a number, too.");
            return new vector(this.x + x, this.y + y);
        }
        else {
            return this.add(x.x, x.y);
        }
    }
    public subtract(vec: vector): vector;
    public subtract(x: number, y: number): vector;
    public subtract(x: number | vector, y?: number): vector {
        if (typeof x == 'number') {
            if (typeof y != 'number') throw new Error("y must be a number if x is a number, too.");
            return new vector(this.x - x, this.y - y);
        }
        else {
            return this.subtract(x.x, x.y);
        }
    }
    public multiply(val: number): vector {
        return new vector(this.x * val, this.y * val);
    }
    public divide(val: number): vector {
        if (ExtMath.numEquals(val, 0)) throw Error("Can't divide by zero.");
        return new vector(this.x / val, this.y / val);
    }
    public drag(drag: number, delta: number): vector {
        return this.multiply(ExtMath.drag(drag, delta));
    }
    public invert(): vector {
        return new vector(-this.x, -this.y);
    }

    public distance(other: vector) {
        return this.subtract(other).length;
    }
    public squaredDistance(other: vector) {
        return this.subtract(other).lengthSquared;
    }

    public get length(): number {
        return Math.sqrt(this.lengthSquared);
    }
    public get lengthSquared(): number {
        return this.x * this.x + this.y * this.y;
    }
    public get fastInverseLength(): number {
        let number = this.lengthSquared;
        let i;
        let x2, y;
        const threehalfs = 1.5;
    
        x2 = number * 0.5;
        y = number;
        //evil floating bit level hacking
        let buf = new ArrayBuffer(4);
        (new Float32Array(buf))[0] = number;
        i =  (new Uint32Array(buf))[0];
        i = (0x5f3759df - (i >> 1)); //What the fuck?
        (new Uint32Array(buf))[0] = i;
        y = (new Float32Array(buf))[0];
        y = y * ( threehalfs - ( x2 * y * y ) );   // 1st iteration

        return y;
    }
    public get normalized(): vector {
        let len = this.fastInverseLength;
        return new vector(this.x * len, this.y * len);
    }

    public setX(val: number): vector {
        return new vector(val, this.y);
    }
    public setY(val: number): vector {
        return new vector(this.x, val);
    }

    public inViewDistance(other: vector, viewDist: number): boolean {
        let vec = this.subtract(other);
        return Math.abs(vec.x) + Math.abs(vec.y) < viewDist;
    }

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }

    public static fromDirection(direction: number, inRadians: boolean = false): vector {
        if (!inRadians) direction = direction * Math.PI / 180;

        const x = Math.sin(direction);
        const y = Math.cos(direction);

        return new vector(x, -y);
    }
}