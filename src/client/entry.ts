import { map, Observable } from "rxjs";
import WebSocketAsPromised from "websocket-as-promised";
import { vector } from "../common/vector";
import { clientController } from "./clientController";
import { clientSocket } from "./clientSocket";

const overlayEl = document.getElementById('overlay') as HTMLElement;
const guiEl = document.getElementById('gui') as HTMLElement;

(document.getElementById('playbtn') as HTMLElement).onclick = () => {
    let ws = new WebSocket('ws://77.70.55.157:8001');
    ws.onopen = async () => {
        let socket = new clientSocket(ws);
        await clientController.create(socket, (document.getElementById('username') as HTMLInputElement).value);
        overlayEl.style.display = 'none';
        guiEl.style.display = 'block';
    };
};


console.log("When the imposter is sus");