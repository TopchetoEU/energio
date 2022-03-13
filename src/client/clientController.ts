import { fromEvent, Subscription } from "rxjs";
import { packetConnection } from "../common/packetConnection";
import { packetCode } from "../common/packets";
import { controlType } from "../common/packets/client";
import { initPacketData, kickPacketData, tickPacketData } from "../common/packets/server";
import { player } from "../common/player";
import { socket } from "../common/socket";
import { ExtMath, vector } from "../common/vector";
import { energyUnit } from "../common/energy";
import { resources } from "./resources";
import { transformStack } from "./transformStack";
import { arrayProperty } from "../common/props/property";
import { planet } from "../common/planet";
import { clientPlayer } from "./clientPlayer";
import { clientPlanet } from "./clientPlanet";
import { objectChangeApplier, translator } from "../common/props/changeTracker";

const TIMEOUT = 2000;
const onKeydown = fromEvent<KeyboardEvent>(document, 'keydown');
const onKeyup = fromEvent<KeyboardEvent>(document, 'keyup');
const SCALE = 1;

export async function drawImage(canvas: CanvasRenderingContext2D, src: string) {
    let a = await resources.getImage(src);
    canvas.drawImage(a, -a.width / 2, -a.height / 2);
}

export class clientController extends player implements energyUnit {
    public readonly players;
    public readonly planets;
    public readonly planetTranslator: translator<number, planet> = {
        translateFrom: v => v.id,
        translateTo: v => {
            let res = this.planetOwner.planets.value.find(_v => _v.id === v);
            if (res) return res;
            else throw new Error("Invalid planet given.");
        },
    };

    public readonly applier = new objectChangeApplier()
        .prop('ownedPlanets', true, this.planetTranslator)
        .prop('peopleAboard')
        .prop('location', false, vector.pointTranslator)
        .prop('direction')
        .prop('moving')
        .prop('production')
        .prop('consumption');

    private _connection: packetConnection;
    private _subscribers: Subscription[] = [];
    private _delta: number = 0;
    public prevLocation: vector;
    public prevDirection: number;

    private _canvasElement = document.getElementById('game') as HTMLCanvasElement;
    private _canvas = this._canvasElement.getContext('2d') as CanvasRenderingContext2D;

    private lastTickTime: number = 0;

    private onTick(data: tickPacketData): void {
        this._delta = data.delta;
        this.planets.removeIf(planet => data.deletedPlanets.includes(planet.id));
        this.players.removeIf(player => data.deletedPlayers.includes(player.id));

        this.planets.add(...data.newPlanets.map(v => new clientPlanet(this, v)));
        this.players.add(...data.newPlayers.filter(v => v.id !== this.id).map(v => new clientPlayer(this, v)));

        this.selectedPlanet.value = this.getPlanet(data.selectedPlanetId);

        for (let el of data.updatedPlanets) {
            let changeDesc = el.changes;
            let planet = (this.getPlanet(el.id) as clientPlanet | undefined);
            if (planet) {
                let applier = planet.applier;
                applier.applyChanges(changeDesc, planet);
            }
        }
        for (let el of data.updatedPlayers) {
            let changeDesc = el.changes;
            let player = (this.getPlayer(el.id) as clientPlayer | undefined);
            if (player) {
                let applier = player.applier;
                player.prevLocation = player.location.value;
                player.prevDirection = player.direction.value;
                applier.applyChanges(changeDesc, player);
            }
        }

        this.lastTickTime = performance.now();
    }
    private onKick(data: kickPacketData): void {
        throw new Error("Method not implemented.");
    }


    private async drawSelf(canvas: CanvasRenderingContext2D, stack: transformStack) {
        stack.begin();
        stack.translate(new vector(this._canvasElement.width / 2, this._canvasElement.height / 2));

        // stack.translate(new vector(this._canvasElement.width / 2, this._canvasElement.height / 2));
        await drawImage(canvas, '/static/images/player.png');

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
        
        let lerpedDir = ExtMath.lerp(this.prevDirection, this.direction.value, tickDelta);
        let lerpedLoc = this.prevLocation.lerp(this.location.value, tickDelta);
    
        stack.translate(new vector(this._canvasElement.width / 2, this._canvasElement.height / 2));
        stack.rotate(-lerpedDir);
        stack.translate(lerpedLoc.invert());

        for (let player of this.players.value) {
            await (player as clientPlayer).draw(canvas, stack, lerpedDir, tickDelta);
        }
        for (let planet of this.planets.value) {
            await (planet as clientPlanet).draw(this.selectedPlanet.value === planet, canvas, stack);
        }

        stack.end();

        await this.drawSelf(canvas, stack);

        canvasEl.remove();
        this._canvas.drawImage(canvasEl, 0, 0);
    }
    // /**
    //  * Updates energy indicators
    //  */
    // private updateBarElements() {
    //     let percent: number;

    //     if (this.production === 0) percent = 1;
    //     else {
    //         percent = 1 - this.consumption / this.production;
    //         if (percent < 0) percent = 0;
    //     }
    //     // Gets how much of the energy is being consumed

    //     // Updates the text, only if its different, to avoid DOM lag
    //     let newText = `${this.consumption.toFixed(2)}TW / ${this.production.toFixed(2)}TW`;
    //     if (this.percentElement.innerText != newText) this.percentElement.innerText = newText;

    //     // Updates the bar
    //     this.energyBarElement.style.width = `${percent * 100}%`;
    // }
    // private createProperty(name: string, ...values: any[]): HTMLSpanElement[] {
    //     let nameElement = document.createElement('span');
    //     nameElement.innerText = name;
    //     let valueElement = document.createElement('span');
    //     valueElement.innerText = values.join('');

    //     return [ nameElement, valueElement ];
    // }
    // private updateInfoElement() {
    //     if (this.selectedPlanet) {
    //         this.planetInfoElement.style.removeProperty('display');
    //         this.planetPlayersPropsElement.append(...this.createProperty("Limit", this.selectedPlanet.limit, " billion people"));
    //         this.planetPropsElement.append(...this.createProperty("Watt/Capita", this.selectedPlanet.productionPerCapita, "W"));
    //         this.planetPropsElement.append(...this.createProperty("Max production", (this.selectedPlanet.limit * this.selectedPlanet.productionPerCapita / 1000).toFixed(2), "TW"));

    //         if (this.selectedPlanet.owner) {
    //             this.planetPropsElement.append(...this.createProperty("Owner", this.selectedPlanet.owner.name));
    //             this.planetPropsElement.append(...this.createProperty("Population", this.selectedPlanet.population.toFixed(2), " billion people"));
    //             this.planetPropsElement.append(...this.createProperty("Production", this.selectedPlanet.production.toFixed(2), "TW"));
    //         }
    //         this.planetPropsElement.append(...this.createProperty("Consumption", this.selectedPlanet.consumption.toFixed(2), "TW"));

    //         if (this.selectedPlanet.owner === this) {
    //             this.takePeopleElement.style.removeProperty('display');
    //         }
    //         else {
    //             this.takePeopleElement.style.display = 'none';
    //         }
    //     }
    //     else {
    //         this.planetInfoElement.style.display = "none";
    //     }

    //     this.playerPropsElement.innerHTML = '';
    //     this.playerPropsElement.append(...this.createProperty("Name", this.name));
    //     this.playerPropsElement.append(...this.createProperty("People aboard", this.peopleAboard));
    //     // this.peopleInShip 
    // }
    /**
     * Processes a key press
     * @param code The key code to account for
     * @param pressing Whether or not the key has been pressed or released
     */
    private onKey(code: string, pressing: boolean) {
        switch (code) {
            case "KeyW":
            case "ArrowUp":
                this._connection.sendPacket(packetCode.CONTROL, { starting: pressing, type: controlType.Forward });
                break;
            case "KeyA":
            case "ArrowLeft":
                this._connection.sendPacket(packetCode.CONTROL, { starting: pressing, type: controlType.Left });
                break;
            case "KeyD":
            case "ArrowRight":
                this._connection.sendPacket(packetCode.CONTROL, { starting: pressing, type: controlType.Right });
                break;
        }
    }
    /**
     * Gets a player by its id, including the self player
     * @param id Id of the player to get
     * @returns Player that was found
     */
    private getPlayer(id: number) {
        if (id === this.id) return this;
        return this.players.value.find(v => v.id === id);
    }
    /**
     * Gets a planet by its id
     * @param id The id of the planet to get
     * @returns Planet that was sfound
     */
    private getPlanet(id: number) {
        return this.planets.value.find(v => v.id === id);
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
        let players = new arrayProperty<player>();
        let planets = new arrayProperty<planet>();
        super({ planets }, name, packet.selfId, new vector(0, 0), 0);
        this.players = players;
        this.planets = planets;
        this._connection = connection;

        this._subscribers.push(
            onKeydown.subscribe(kb => {
                if (!kb.repeat) this.onKey(kb.code, true);
            }),
            onKeyup.subscribe(kb => this.onKey(kb.code, false)),
        );

        this._connection.onPacket<tickPacketData>(packetCode.TICK).subscribe(v => this.onTick(v.data));
        this._connection.onPacket<kickPacketData>(packetCode.KICK).subscribe(v => this.onKick(v.data));
        
        this.lastTickTime = performance.now();

        this.prevDirection = this.direction.value;
        this.prevLocation = this.location.value;

        requestAnimationFrame(this.frame.bind(this));
    }

    /**
     * Creates a new client controller from a socket
     * @param socket The socket to use
     * @param name The name of the self player to use
     * @returns The newly created controller
     */
    public static async create(socket: socket, name: string): Promise<clientController> {
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