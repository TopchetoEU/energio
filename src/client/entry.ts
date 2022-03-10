import { vector } from "../common/vector";

class bgObjecet {
    private _position: vector;
    private rotation: vector;
    public element: HTMLImageElement;

    public get position(): vector {
        return this._position;
    }
    public set position(val: vector) {
        this._position = val;
        this.update();
    }

    public update(): void {
        this.element.style.position = 'fixed';
        this.element.style.left = this.position.x + 'px';
        this.element.style.top = this.position.y + 'px';
    }

    constructor(imgSrc: string, position: vector, rotation?: vector | undefined) {
        this.element = document.createElement('img');
        this.element.src = imgSrc;
        this._position = position;
        if (rotation) this.rotation = rotation.normalized;
        else this.rotation = new vector(1, 0);
    }
}

const bgElement = document.getElementById('background');
const obj = new bgObjecet('/static/images/planet-1.png', new vector(100, 500));
obj.update();
bgElement?.appendChild(obj.element);

document.body.onmousedown = e => {
    obj.position = new vector(e.clientX, e.clientY);
}