import { clientSocket } from "./clientSocket";
import { clientController } from "./clientController";
import detectzoom from "./detectZoom";

let req = new XMLHttpRequest();
req.open('GET', './serverip.txt');
req.send(undefined);

req.onreadystatechange = () => {
    const ip = req.response;
    const overlayEl = document.getElementById('modal') as HTMLElement;
    const guiEl = document.getElementById('gui') as HTMLElement;
    const canvasEl = document.getElementById('game') as HTMLCanvasElement;

    function updateSize() {
        let zoom = detectzoom.zoom;
        canvasEl.width = window.innerWidth * zoom;
        canvasEl.height = window.innerHeight * zoom;
    }
    updateSize();
    
    window.onresize = updateSize;
    
    document.getElementById('playbtn')!.onclick = () => {
        let ws = new WebSocket('ws://' + ip + ':8002');
        ws.onopen = async () => {
            let socket = new clientSocket(ws);
            let element = document.getElementById('username') as HTMLInputElement;
            clientController.createClientController(socket, element.value);
            overlayEl.style.display = 'none';
            guiEl.style.display = 'block';
        };
    };
    
    
    console.log("When the imposter is sus");
}
