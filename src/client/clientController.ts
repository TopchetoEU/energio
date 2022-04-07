import { fromEvent, Subscription } from "rxjs";
import { packetConnection } from "../common/packetConnection";
import { packetCode } from "../common/packets";
import { controlType, shipControlPacketData } from "../common/packets/client";
import { assetData, effectPacketData, initPacketData, kickPacketData, serverChatPacketData, tickPacketData } from "../common/packets/server";
import { player } from "../common/player";
import { socket } from "../common/socket";
import { ExtMath, vector } from "../common/vector";
import { energyUnit } from "../common/energy";
import { assets } from "./assets";
import { transformStack } from "./transformStack";
import { planet } from "../common/planet";
import { clientPlayer } from "./clientPlayer";
import { clientPlanet } from "./clientPlanet";
import { register, registerProp } from "../common/props/register";
import { translators } from "../common/props/translator";
import { gameObjectManager } from "../common/gameObject";
import { appliable, constructorExtender } from "../common/props/decorators";
import { appliableObject, objectChangeApplier } from "../common/props/changes";
import { clientLaser } from "./clientLaser";
import { laserAttribs } from "../common/laser";

const TIMEOUT = 2000;
const onKeydown = fromEvent<KeyboardEvent>(document, 'keydown');
const onKeyup = fromEvent<KeyboardEvent>(document, 'keyup');
const SCALE = 1;

export function drawImage(canvas: CanvasRenderingContext2D, src: string, centered = true) {
    let a = assets.get(src, 'image')?.data;
    if (a) {
        if (centered) canvas.drawImage(a, -a.width / 2, -a.height / 2);
        else canvas.drawImage(a, 0, -0);
    }
}

/**
 * An object, representing the player, playing the game. It does the communication between the client and the server
 */
// @constructorExtender<clientController>()
@appliable()
export class clientController extends player implements energyUnit, appliableObject {
    public readonly location = vector.zero;
    public readonly direction = 0;
    public readonly production = 0;
    public readonly chatBubble = '';
    public readonly consumption = 0;
    public readonly laserAttribs!: laserAttribs;
    public readonly name: string;
    public readonly applier = new objectChangeApplier(this);
    @registerProp({
        translator: translators<player, string>()
            .from(v => gameObjectManager.getTyped(v, clientPlayer))
            .to(v => v.id)
    })
    public readonly players = new register<clientPlayer | clientController>((a, b) => a.id === b.id);
    public readonly planets = new register<clientPlanet>((a, b) => a.id === b.id);
    public readonly lasers = new register<clientLaser>((a, b) => a.id === b.id);

    private gameElement = document.getElementById('game') as HTMLDivElement;
    private chatElement = document.getElementById('chat') as HTMLDivElement;
    private chatInputElement = document.getElementById('chatinput') as HTMLInputElement;
    private percentElement = document.getElementById('engpercent') as HTMLSpanElement;
    private energyBarElement = document.getElementById('energybar') as HTMLDivElement;

    private planetInfoElement = document.getElementById('planetinfo') as HTMLDivElement;
    private planetPropsElement = document.getElementById('planetprops') as HTMLDivElement;
    private playerPropsElement = document.getElementById('playerprops') as HTMLDivElement;

    private takePeopleElement = document.getElementById('planetTakePeople') as HTMLDivElement;
    private peopleCountElement = document.getElementById('peoplecount') as HTMLInputElement;
    private takePeopleBtnElement = document.getElementById('takepeoplebtn') as HTMLButtonElement;
    private leavePeopleBtnElement = document.getElementById('leavepeoplebtn') as HTMLButtonElement;

    public readonly connection: packetConnection;
    private _delta: number = 0;
    public prevLocation: vector;
    public prevDirection: number;

    private _canvasElement = document.getElementById('game') as HTMLCanvasElement;
    private _canvas = this._canvasElement.getContext('2d') as CanvasRenderingContext2D;

    private lastTickTime: number = 0;
    private lastTime: number = 0;

    private onTick(data: tickPacketData): void {
        this._delta = data.delta;
        if (data.deletedPlanets !== void 0) this.planets.removeIf(planet => data.deletedPlanets!.includes(planet.id));
        if (data.deletedPlayers !== void 0) this.players.removeIf(player => data.deletedPlayers!.includes(player.id));

        if(data.newPlanets !== void 0) this.planets.add(...data.newPlanets.map(v => new clientPlanet(v, v => this.players.removeIf(el => el.id === v.id))));
        if(data.newPlayers !== void 0) {
            this.players.add(...data.newPlayers.filter(v => v!.id !== this.id).map(v => new clientPlayer(v)));
            data.newPlayers.filter(v => v!.id === this.id).forEach(v => {
                this.applier.apply(v);
            });
        }

        for (let player of this.players.array) {
            player.prevLocation = player.location;
            player.prevDirection = player.direction;
        }

        try {
            if (data.selectedPlanetId !== void 0) this.selectedPlanet = gameObjectManager.getTypedMaybe(data.selectedPlanetId, planet);
    
            if (data.updatedPlayers !== void 0) {
                for (let id in data.updatedPlayers) {
                    let changeDesc = data.updatedPlayers[id];
                    let p = gameObjectManager.getTypedMaybe(id, player);
                    if (p instanceof clientPlayer || p instanceof clientController) {
                        let applier = p.applier;
                        applier.apply(changeDesc);
                    }
                }
            }
            if (data.updatedPlanets !== void 0) {
                for (let id in data.updatedPlanets) {
                    let changeDesc = data.updatedPlanets[id];
                    let planet = (gameObjectManager.get(id) as clientPlanet | undefined);
                    if (planet) {
                        let applier = planet.applier;
                        applier.apply(changeDesc);
                        if (changeDesc?.owner !== void 0) planet.owner = gameObjectManager.getTypedMaybe(changeDesc.owner, player);
                    }
                }
            }
        }
        catch {}


        this.updateInfoElement();
        this.updateBarElements();
        this.lastTickTime = performance.now();
    }
    private onKick(data: kickPacketData): void {
        // TODO: Implement kick logic
    }
    private onEffect(data: effectPacketData): void {
        if (data.type === "laser") {
            let laser = new clientLaser(data.id,
                vector.fromPoint(data.velocity), vector.fromPoint(data.location),
                data.size, data.decay, data.power,
                v => this.lasers.remove(v as clientLaser)
            );
            this.lasers.add(laser);

            laser.onDecay.subscribe(() => laser.remove());
        }
    }
    private onChat(data: serverChatPacketData) {
        const bElement = document.createElement('b');
        const contentElement = document.createElement('span');
        const containerElement = document.createElement('div');

        if (data.name) {
            bElement.innerText = data.name + ": ";
            contentElement.innerText = data.message;
            containerElement.append(bElement, contentElement);
        }
        else {
            bElement.innerText = data.message;
            containerElement.append(bElement);
        }

        this.chatElement.append(containerElement);
    }

    public static drawBubble(canvas: CanvasRenderingContext2D, stack: transformStack, clientRotation: number, bubble: string) {
        stack.rotate(clientRotation);
        stack.translate(new vector(0, -130));

        canvas.fillStyle = '#fff';
        canvas.strokeStyle = 'solid #000';
        canvas.textAlign = 'center';
        canvas.font = 'bold 20px Arial';

        canvas.beginPath();
        canvas.fillText(bubble, 0, 0);
        canvas.fill();
        
        canvas.beginPath();
        canvas.strokeText(bubble, 0, 0);
        canvas.stroke();
    }
    private async drawSelf(canvas: CanvasRenderingContext2D, stack: transformStack) {
        stack.begin();
        stack.translate(new vector(this._canvasElement.width / 2, this._canvasElement.height / 2));

        // stack.translate(new vector(this._canvasElement.width / 2, this._canvasElement.height / 2));
        await drawImage(canvas, 'player');

        clientController.drawBubble(canvas, stack, 0, this.chatBubble);

        stack.end();
    }

    /**
     * Updates transformation of player and game
     */
    private async redraw(tickDelta: number, delta: number) {
        let canvasEl = document.createElement('canvas');
        canvasEl.width = this._canvasElement.width;
        canvasEl.height = this._canvasElement.height;
        let canvas = canvasEl.getContext('2d') as CanvasRenderingContext2D;

        canvas.beginPath();
        canvas.rect(0, 0, this._canvasElement.width, this._canvasElement.height);
        canvas.fillStyle = '#000';
        canvas.fill();

        let stack = new transformStack(canvas);
        stack.begin();
        
        let lerpedDir = ExtMath.lerp(this.prevDirection, this.direction, tickDelta);
        let lerpedLoc = this.prevLocation.lerp(this.location, tickDelta);
    
        stack.translate(new vector(this._canvasElement.width / 2, this._canvasElement.height / 2));
        stack.rotate(-lerpedDir);
        stack.translate(lerpedLoc.invert());

        for (let planet of this.planets.array) {
            await (planet as clientPlanet).draw(this.selectedPlanet?.id === planet.id, canvas, stack);
        }
        for (let laser of this.lasers.array) {
            laser.update(delta);
            laser.draw(canvas, stack);
        }
        for (let player of this.players.array) {
            if (player instanceof clientPlayer)
                await (player as clientPlayer).draw(canvas, stack, lerpedDir, tickDelta);
        }

        stack.end();

        await this.drawSelf(canvas, stack);

        canvasEl.remove();
        this._canvas.drawImage(canvasEl, 0, 0);
    }
    /**
     * Updates energy indicators
     */
    private updateBarElements() {
        let percent: number;

        if (this.production === 0) percent = 1;
        else {
            percent = 1 - this.consumption / this.production;
            if (percent < 0) percent = 0;
        }
        // Gets how much of the energy is being consumed

        // Updates the text, only if its different, to avoid DOM lag
        let newText = `${this.consumption.toFixed(2)}TW / ${this.production.toFixed(2)}TW`;
        if (this.percentElement.innerText != newText) this.percentElement.innerText = newText;

        // Updates the bar
        this.energyBarElement.style.width = `${percent * 100}%`;
    }
    private createProperty(name: string, ...values: any[]): HTMLSpanElement[] {
        let nameElement = document.createElement('span');
        nameElement.innerText = name;
        let valueElement = document.createElement('span');
        valueElement.innerText = values.join('');

        return [ nameElement, valueElement ];
    }
    private updateInfoElement() {
        if (this.selectedPlanet) {
            this.planetInfoElement.style.removeProperty('display');
            this.planetPropsElement.innerHTML = '';
            this.planetPropsElement.append(...this.createProperty("Limit", this.selectedPlanet.limit, " billion people"));
            this.planetPropsElement.append(...this.createProperty("Watt/Capita", this.selectedPlanet.productionPerCapita, "W"));
            this.planetPropsElement.append(...this.createProperty("Max production", (this.selectedPlanet.limit * this.selectedPlanet.productionPerCapita / 1000).toFixed(2), "TW"));

            if (this.selectedPlanet.owner) {
                this.planetPropsElement.append(...this.createProperty("Owner", this.selectedPlanet.owner.name));
                this.planetPropsElement.append(...this.createProperty("Population", this.selectedPlanet.population.toFixed(2), " billion people"));
                // this.planetPropsElement.append(...this.createProperty("Production", this.selectedPlanet.production.toFixed(2), "TW"));
            }
            // this.planetPropsElement.append(...this.createProperty("Consumption", this.selectedPlanet.consumption.toFixed(2), "TW"));
        }
        else {
            this.planetInfoElement.style.display = "none";
        }

        this.playerPropsElement.innerHTML = '';
        this.playerPropsElement.append(...this.createProperty("Name", this.name));
        this.playerPropsElement.append(...this.createProperty("People aboard", this.peopleAboard + " billion"));
        this.playerPropsElement.append(...this.createProperty("Owned planets", this.ownedPlanets.length));
        // this.peopleInShip 
    }
    /**
     * Processes a key press
     * @param code The key code to account for
     * @param pressing Whether or not the key has been pressed or released
     */
    private onKey(code: string, pressing: boolean) {
        switch (code) {
            case "KeyW":
            case "ArrowUp":
                this.connection.sendPacket(packetCode.CONTROL, { starting: pressing, type: controlType.Forward });
                break;
            case "KeyA":
            case "ArrowLeft":
                this.connection.sendPacket(packetCode.CONTROL, { starting: pressing, type: controlType.Left });
                break;
            case "KeyD":
            case "ArrowRight":
                this.connection.sendPacket(packetCode.CONTROL, { starting: pressing, type: controlType.Right });
                break;
            case "Space":
                this.connection.sendPacket(packetCode.CONTROL, { starting: pressing, type: controlType.Fire });
                break;
            case "Enter":
                if (pressing)
                this.chatInputElement.focus();
        }
    }

    private async frame(time: number) {
        await this.redraw((time - this.lastTickTime) / (this._delta * 1000), (time - this.lastTime) / 1000);
        this.lastTime = time;
        requestAnimationFrame(this.frame.bind(this));
    }

    private static loadAssets(_assets: assetData[]) {
        return new Promise<void>((resolve, reject) => {
            const loadingEl = document.getElementById('loading')!;
            const guiEl = document.getElementById('gui')!;
            const loadingbarEl = document.getElementById('loadingbar')!;
            loadingbarEl.style.width = "0%";
            loadingEl.style.removeProperty('display');
            assets.load(..._assets).subscribe({
                next: v => {
                    loadingbarEl.style.width =  100 * (v.i / _assets.length) + '%';
                },
                complete: () => {
                    loadingEl.style.display = 'none';
                    guiEl.style.removeProperty('display');
                    resolve();
                },
                error: v => reject(v),
            });
        });
    }

    /**
     * Creates a client controller from initPacketData
     * @param packet A packet that contains initialization data
     * @param connection The connection of the self player
     * @param name The name of the self player
     */
    public constructor(packet: initPacketData, connection: packetConnection, name: string) {
        super(packet.selfId);

        this.players.add(this);
        this.connection = connection;
        this.name = name;

        this.gameElement.style.removeProperty('display');

        this.connection.onPacket<tickPacketData>(packetCode.TICK).subscribe(v => this.onTick(v.data));
        this.connection.onPacket<kickPacketData>(packetCode.KICK).subscribe(v => this.onKick(v.data));
        this.connection.onPacket<effectPacketData>(packetCode.EFFECT).subscribe(v => this.onEffect(v.data));
        this.connection.onPacket<serverChatPacketData>(packetCode.CHAT).subscribe(v => this.onChat(v.data));
        this.connection.onPacket<effectPacketData>(packetCode.ENDEFFECT).subscribe(v => {
            gameObjectManager.getTypedMaybe(v.data.id, clientLaser)?.remove();
        });

        this.gameElement.onkeydown = kb => {
            if (!kb.repeat) this.onKey(kb.code, true);
        };
        this.gameElement.onkeyup = kb => this.onKey(kb.code, false);
        
        this.lastTickTime = performance.now();

        this.prevDirection = 0;
        this.prevLocation = vector.zero;

        this.leavePeopleBtnElement.onclick = () => {
            this.connection.sendPacket(packetCode.SHIPCONTROL, {
                count: Number.parseInt(this.peopleCountElement.value),
                leave: true,
            } as shipControlPacketData);
        };
        this.takePeopleBtnElement.onclick = () => {
            this.connection.sendPacket(packetCode.SHIPCONTROL, {
                count: Number.parseInt(this.peopleCountElement.value),
                leave: false,
            } as shipControlPacketData);
        };

        this.gameElement.focus();
        this.chatInputElement.onkeydown = e => {
            if (e.code === "Enter" && this.chatInputElement.value !== '') {
                connection.sendPacket(packetCode.CHAT, {
                    message: this.chatInputElement.value,
                });
                this.chatInputElement.value = "";
                this.gameElement.focus();
            }
        }

        requestAnimationFrame(this.frame.bind(this));
    }

    /**
     * Creates a new client controller from a socket
     * @param socket The socket to use
     * @param name The name of the self player to use
     * @returns The newly created controller
     */
    public static async createClientController(socket: socket, name: string): Promise<clientController> {
        const con = new packetConnection(socket, TIMEOUT);
        con.sendPacket(packetCode.LOGIN, { name });
        let res = await Promise.race([
            con.onceError(),
            con.oncePacket<initPacketData>(packetCode.INIT),
        ]);
    
        if (res.type === "ERR") {
            throw new Error(res.message + ": " + res.description);
        }
        else {
            await this.loadAssets(res.data.assets);
            await con.sendPacket(packetCode.ACKNASSETS, undefined);
            return new clientController(res.data, con, name);
        }
    }
}

