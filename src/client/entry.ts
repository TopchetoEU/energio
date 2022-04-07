import { clientSocket } from "./clientSocket";
import { clientController } from "./clientController";
import detectzoom from "./detectZoom";

const formEl = document.getElementById('form') as HTMLElement;
const guiEl = document.getElementById('gui') as HTMLElement;
const loadingEl = document.getElementById('loading') as HTMLElement;
const canvasEl = document.getElementById('game') as HTMLCanvasElement;

guiEl.style.display = 'none';
loadingEl.style.display = 'none';
canvasEl.style.display = 'none';

document.body.style.removeProperty('display');

fetch('./serverip.txt')
    .then(async v => {
        const ip = await v.text();
    
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
                formEl.style.display = 'none';
            };
        };
        console.log("When the imposter is sus");
    })
    .catch(v => console.error(v));


