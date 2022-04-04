import { fromEvent, Subscription } from "rxjs";
import { packetConnection } from "../common/packetConnection";
import { packetCode } from "../common/packets";
import { controlType, shipControlPacketData } from "../common/packets/client";
import { initPacketData, kickPacketData, tickPacketData } from "../common/packets/server";
import { player } from "../common/player";
import { socket } from "../common/socket";
import { ExtMath, vector } from "../common/vector";
import { energyUnit } from "../common/energy";
import { resources } from "./resources";
import { transformStack } from "./transformStack";
import { planet } from "../common/planet";
import { clientPlayer } from "./clientPlayer";
import { clientPlanet } from "./clientPlanet";
import { register, registerProp } from "../common/props/register";
import { translators } from "../common/props/translator";
import { gameObjectManager } from "../common/gameObject";
import { afterConstructor, appliable, constructorExtender, extendConstructor, propOwner } from "../common/props/decorators";
import { appliableObject, objectChangeApplier } from "../common/props/changes";

const TIMEOUT = 2000;
const onKeydown = fromEvent<KeyboardEvent>(document, 'keydown');
const onKeyup = fromEvent<KeyboardEvent>(document, 'keyup');
const SCALE = 1;

export async function drawImage(canvas: CanvasRenderingContext2D, src: string, centered = true) {
    let a = await resources.getImage(src);
    if (centered) canvas.drawImage(a, -a.width / 2, -a.height / 2);
    else canvas.drawImage(a, 0, -0);
}

@constructorExtender<clientController>()
@appliable()
@propOwner()
export class clientController extends player implements energyUnit, appliableObject {
    public readonly name: string;
    public readonly applier = new objectChangeApplier(this);
    @registerProp((_this: clientController) => ({
        translator: translators<player, string>()
            .from(v => gameObjectManager.get(v) as clientPlayer)
            .to(v => v.id)
    }))
    public readonly players = new register<player>((a, b) => a.id === b.id);
    public readonly planets = new register<planet>((a, b) => a.id === b.id);

    private gameElement = document.getElementById('game') as HTMLDivElement;
    private playerElement = document.getElementById('self') as HTMLDivElement;
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
    private _subscribers: Subscription[] = [];
    private _delta: number = 0;
    public prevLocation: vector;
    public prevDirection: number;

    private _canvasElement = document.getElementById('game') as HTMLCanvasElement;
    private _canvas = this._canvasElement.getContext('2d') as CanvasRenderingContext2D;

    private lastTickTime: number = 0;

    private onTick(data: tickPacketData): void {
        this._delta = data.delta;
        if (data.deletedPlanets !== void 0) this.planets.removeIf(planet => data.deletedPlanets!.includes(planet.id));
        if (data.deletedPlayers !== void 0) this.players.removeIf(player => data.deletedPlayers!.includes(player.id));

        if(data.newPlanets !== void 0) this.planets.add(...data.newPlanets.map(v => new clientPlanet(v)));
        if(data.newPlayers !== void 0) this.players.add(...data.newPlayers.filter(v => v.id !== this.id).map(v => new clientPlayer(v)));

        if (data.selectedPlanetId !== void 0) this.selectedPlanet = gameObjectManager.getTypedMaybe(data.selectedPlanetId, planet);

        if (data.updatedPlayers !== void 0) {
            for (let el of data.updatedPlayers) {
                let changeDesc = el.changes;
                let p = gameObjectManager.getTypedMaybe(el.id, player);
                if (p instanceof clientPlayer || p instanceof clientController) {
                    let applier = p.applier;
                    p.prevLocation = p.location;
                    p.prevDirection = p.direction;
                    applier.apply(changeDesc);
                }
            }
        }
        if (data.updatedPlanets !== void 0) {
            for (let el of data.updatedPlanets) {
                let changeDesc = el.changes;
                let planet = (gameObjectManager.get(el.id) as clientPlanet | undefined);
                if (planet) {
                    let applier = planet.applier;
                    applier.apply(changeDesc);
                    if (changeDesc.owner !== void 0) planet.owner = gameObjectManager.getTypedMaybe(changeDesc.owner, player);
                }
            }
        }

        this.updateInfoElement();
        this.updateBarElements();
        this.lastTickTime = performance.now();
    }
    private onKick(data: kickPacketData): void {
        // TODO: Implement kick logic
    }


    private async drawSelf(canvas: CanvasRenderingContext2D, stack: transformStack) {
        stack.begin();
        stack.translate(new vector(this._canvasElement.width / 2, this._canvasElement.height / 2));

        // stack.translate(new vector(this._canvasElement.width / 2, this._canvasElement.height / 2));
        await drawImage(canvas, 'player.png');

        stack.end();
    }

    /**
     * Updates transformation of player and game
     */
    private async redraw(tickDelta: number) {
        let canvasEl = document.createElement('canvas');
        canvasEl.width = this._canvasElement.width;
        canvasEl.height = this._canvasElement.height;
        let canvas = canvasEl.getContext('2d') as CanvasRenderingContext2D;

        canvas.fillStyle = '#000';
        canvas.fillRect(0, 0, this._canvasElement.width, this._canvasElement.height);

        let stack = new transformStack(canvas);
        // stack.transformOrigin = new vector(this._canvasElement.width / 2, this._canvasElement.height / 2);
        stack.begin();
        
        let lerpedDir = ExtMath.lerp(this.prevDirection, this.direction, tickDelta);
        let lerpedLoc = this.prevLocation.lerp(this.location, tickDelta);
    
        stack.translate(new vector(this._canvasElement.width / 2, this._canvasElement.height / 2));
        stack.rotate(-lerpedDir);
        stack.translate(lerpedLoc.invert());

        for (let player of this.players.array) {
            if (player instanceof clientPlayer)
                await (player as clientPlayer).draw(canvas, stack, lerpedDir, tickDelta);
        }
        for (let planet of this.planets.array) {
            await (planet as clientPlanet).draw(this.selectedPlanet?.id === planet.id, canvas, stack);
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
        }
    }

    private async frame(time: number) {
        await this.redraw((time - this.lastTickTime) / (this._delta * 1000));
        requestAnimationFrame(this.frame.bind(this));
    }

    /**
     * Creates a client controller from initPacketData
     * @param packet A packet that contains initialization data
     * @param connection The connection of the self player
     * @param name The name of the self player
     */
    public constructor(packet: initPacketData, connection: packetConnection, name: string) {
        super(packet.selfId, new vector(0, 0));
        
        this.players.add(this);
        this.connection = connection;
        this.name = name;

        this._subscribers.push(
            onKeydown.subscribe(kb => {
                if (!kb.repeat) this.onKey(kb.code, true);
            }),
            onKeyup.subscribe(kb => this.onKey(kb.code, false)),
        );

        this.connection.onPacket<tickPacketData>(packetCode.TICK).subscribe(v => this.onTick(v.data));
        this.connection.onPacket<kickPacketData>(packetCode.KICK).subscribe(v => this.onKick(v.data));
        
        this.lastTickTime = performance.now();

        this.prevDirection = this.direction;
        this.prevLocation = this.location;

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

        requestAnimationFrame(this.frame.bind(this));
    }

    @afterConstructor()
    private afterConstr(packet: initPacketData) {
        this.applier.apply(packet);
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
            return new clientController(res.data, con, name);
        }
    }
}

