import { map, Observable } from "rxjs";
import WebSocketAsPromised from "websocket-as-promised";
import { vector } from "../common/vector";
import { clientController } from "./clientController";
import { clientSocket } from "./clientSocket";

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
const overlayEl = document.getElementById('overlay') as HTMLElement;

(document.getElementById('playbtn') as HTMLElement).onclick = () => {
    overlayEl.style.display = 'none';

    let ws = new WebSocket('ws://77.70.55.157:8001');
    ws.onopen = async () => {
        let socket = new clientSocket(ws);
        let a = await clientController.create(socket, (document.getElementById('username') as HTMLInputElement).value);
    };
};


