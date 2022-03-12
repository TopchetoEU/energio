import { fromEvent, Subscription } from "rxjs";
import { packetConnection } from "../common/packetConnection";
import { packetCode } from "../common/packets";
import { controlType } from "../common/packets/client";
import { delPlanetPacketData, delPlayerPacketData, disownPlanetPacketData, initPacketData, movePacketData, newPlanetPacketData, newPlayerPacketData, ownPlanetPacketData, selectPlanetPacketData, syncEngPacketData, syncPlanet as syncPlanetPacketData, syncPosPacketData } from "../common/packets/server";
import { player } from "../common/player";
import { socket } from "../common/socket";
import { vector } from "../common/vector";
import { energyUnit } from "../server/energy";
import { clientPlanet } from "./clientPlanet";
import { clientPlayer } from "./clientPlayer";
import { resources } from "./resources";
import { transformStack } from "./transformStack";

const TIMEOUT = 2000;
const onKeydown = fromEvent<KeyboardEvent>(document, 'keydown');
const onKeyup = fromEvent<KeyboardEvent>(document, 'keyup');
const SCALE = 1;

export class clientController extends player implements energyUnit {
    private _connection: packetConnection;
    private subscribers: Subscription[] = [];
    private players: clientPlayer[] = [];
    private planets: clientPlanet[] = [];
    private selectedPlanet: clientPlanet | null = null;

    private _consumption: number = 0;
    private _production: number = 0;

    private canvasElement = document.getElementById('game') as HTMLCanvasElement;
    private canvas = this.canvasElement.getContext('2d') as CanvasRenderingContext2D;

    /**
     * Updates transformation of player and game
     */
    private async redraw(tickDelta: number) {
        let stack = new transformStack(this.canvas);
        stack.begin();

        stack.translate(new vector(this.canvasElement.width / 2, this.canvasElement.height / 2));

        stack.translate(this.location.invert());
        stack.rotate(-this.direction);

        for (let player of this.players) {
            await player.draw(this.canvas, stack, tickDelta);
        }

        this.canvas.drawImage(await resources.getImage('/static/images/rocket.png'), 0, 0);

        stack.end();
        stack.end();
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

            this.planetPropsElement.append(...this.createProperty("Name", this.selectedPlanet.name));
            this.planetPropsElement.append(...this.createProperty("Limit", this.selectedPlanet.limit, " billion people"));
            this.planetPropsElement.append(...this.createProperty("Watt/Capita", this.selectedPlanet.productionPerCapita, "W"));
            this.planetPropsElement.append(...this.createProperty("Max production", (this.selectedPlanet.limit * this.selectedPlanet.productionPerCapita / 1000).toFixed(2), "TW"));

            if (this.selectedPlanet.owner) {
                this.planetPropsElement.append(...this.createProperty("Owner", this.selectedPlanet.owner.name));
                this.planetPropsElement.append(...this.createProperty("Population", this.selectedPlanet.population.toFixed(2), " billion people"));
                this.planetPropsElement.append(...this.createProperty("Production", this.selectedPlanet.production.toFixed(2), "TW"));
            }
            this.planetPropsElement.append(...this.createProperty("Consumption", this.selectedPlanet.consumption.toFixed(2), "TW"));

            if (this.selectedPlanet.owner === this) {
                this.takePeopleElement.style.removeProperty('display');
            }
            else {
                this.takePeopleElement.style.display = 'none';
            }
        }
        else {
            this.planetInfoElement.style.display = "none";
        }

        this.playerPropsElement.innerHTML = '';
        this.playerPropsElement.append(...this.createProperty("Name", this.name));
        this.playerPropsElement.append(...this.createProperty("People aboard", this.peopleInShip));
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
     * Handles the packet packetCode.SYNCMOV.
     * Updates the player's location and direction and calls updateElement
     * @param packet Packet that initiated this event
     */
    private onSyncMov(packet: syncPosPacketData) {
        this.location = new vector(packet.location.x, packet.location.y);
        this.direction = packet.direction;
        this.peopleInShip = packet.pplAboard;
        console.log(packet.pplAboard);

        this.redraw();
        this.updateInfoElement();
    }
    /**
     * Handles the packet packetCode.SYNCENG.
     * Updates all energy-related parameters, and calls updateBarElements
     * @param packet Packet that initiated this event
     */
    private onSyncEng(packet: syncEngPacketData) {
        this._consumption = packet.consumption;
        this._production = packet.production;
        this.updateBarElements();
    }
    private onSyncPlanet(packet: syncPlanetPacketData) {
        let planet = this.getPlanet(packet.planetId);
        this.updateInfoElement();
        planet?.sync(packet);
    }   
    /**
     * Handles the packet packetCode.NEWPLAYER.
     * Creates the new player and its element in the DOM tree
     * @param packet Packet that initiated this event
     */
    private onNewPlayer(packet: newPlayerPacketData) {
        if (packet.playerId === this.id) return;
        this.players.push(new clientPlayer(packet, this));
    }
    /**
     * Handles the packet packetCode.DELPLAYER.
     * Removes the player and its element in the DOM tree
     * @param packet Packet that initiated this event
     */
    private onDelPlayer(packet: delPlayerPacketData) {
        this.players = this.players.filter(v => {
            if (v.id === packet.playerId) {
                v.element.remove();
                return false;
            }
            return true;
        });
    }
    /**
     * Handles the packet packetCode.MOVE.
     * Updates the specified player's location and direction, as well as on the DOM tree
     * @param packet Packet that initiated this event
     */
    private onMovePlayer(packet: movePacketData) {
        if (packet.playerId === this.id) return;
        this.players.find(v => v.id === packet.playerId)?.update(packet);
    }
    /**
     * Handles the packet packetCode.NEWPLANET.
     * Creates the new planet and adds it to the DOM tree
     * @param data Packet that initiated this event
     */
    private onNewPlanet(data: newPlanetPacketData): void {
        let planet = new clientPlanet(data);
        this.planets.push(planet);
        planet.updateElement();
    }
    /**
     * Gets a player by its id, including the self player
     * @param id Id of the player to get
     * @returns Player that was found
     */
    private getPlayer(id: number) {
        if (id === this.id) return this;
        return this.players.find(v => v.id === id);
    }
    /**
     * Gets a planet by its id
     * @param id The id of the planet to get
     * @returns Planet that was sfound
     */
    private getPlanet(id: number) {
        return this.planets.find(v => v.id === id);
    }
    /**
     * Handles the packet packetCode.OWNPLANET.
     * Sets the owner of the planet. If the owner matches
     * with the self player, its added to the list of
     * self owned planets, too
     * @param data Packet that initiated this event
     */
    private onOwnPlanet(data: ownPlanetPacketData): void {
        let planet = this.getPlanet(data.planetId);
        let player = this.getPlayer(data.playerId);

        if (planet) {
            this.planets.push(planet);
            if (player) planet.owner = player;
            planet.updateElement();
            if (player === this) {
                this.ownPlanets.push(planet);
            }
            this.updateInfoElement();
        }
    }
    /**
     * Handles the packet packetCode.DISOWNPLANET.
     * Removes the owner of the disowned planet. If the owner is the self player,
     * the planet is removed from the self owned planets, too
     * @param data Packet that initiated this event
     */
    private onDisownPlanet(data: disownPlanetPacketData): void {
        let planet = this.getPlanet(data.planetId);

        if (planet) {
            if (planet.owner === this) {
                this.ownPlanets = this.ownPlanets.filter(v => v.id !== planet?.id);
            }
            planet.owner = undefined;
            planet.updateElement();
            this.updateInfoElement();
        }
    }
    /**
     * Handles the packet packetCode.SELECTPLANET
     * Selects the specified planet, or if none is specified,
     * deselects the current planet.
     * Updates the DOM tree appropriately
     * @param data Packet that initiated this event
     */
    private onSelectPlanet(data: selectPlanetPacketData) {
        // Checks if same planet is being selected
        if (data.planetId === this.selectedPlanet?.id) return;

        if (typeof data.planetId === 'undefined') {
            // Deselect currently selected planet
            if (this.selectedPlanet) {
                this.selectedPlanet.selected = false;
                this.selectedPlanet.updateElement();
                this.selectedPlanet = null;
            }
        }
        else {
            let planet = this.getPlanet(data.planetId);

            // If we don't have the planet, we ignore the packet, otherwise, we
            // deselect currently selected planet and select the given planet
            if (planet) {
                if (this.selectedPlanet) {
                    this.selectedPlanet.selected = false;
                    this.selectedPlanet.updateElement();
                }
                if (this.ownPlanets.includes(planet)) planet.selected = true;
                planet.updateElement();
                this.selectedPlanet = planet;
            }
        }

        this.updateInfoElement();
    }
    /**
     * Handles the packet packetCode.DELPLANET
     * This never gets called, since planets never get deleted
     * @param data Packet that initiated this event
     */
    private onDelPlanet(data: delPlanetPacketData): void {
        this.planets = this.planets.filter(v => {
            if (v.id === data.id) {
                v.element.remove();
                return false;
            }
            return true;
        });
    }

    public get balance(): number {
        return this.production - this.consumption;
    }
    public get production() {
        return this._production;
    }
    public get consumption() {
        return this._consumption;
    }

    /**
     * Creates a client controller from initPacketData
     * @param packet A packet that contains initialization data
     * @param connection The connection of the self player
     * @param name The name of the self player
     */
    public constructor(packet: initPacketData, connection: packetConnection, name: string) {
        super(name, packet.selfId, new vector(packet.location.x, packet.location.y), packet.rotation);
        this._connection = connection;
    
        this.subscribers.push(
            onKeydown.subscribe(kb => {
                if (!kb.repeat) this.onKey(kb.code, true);
            }),
            onKeyup.subscribe(kb => this.onKey(kb.code, false)),
        );

        this.takePeopleCountElement.oninput = () => {
            let val = this.takePeopleCountElement.value;
            try {
                let numVal = Number.parseFloat(val);
                if (numVal > (this.selectedPlanet?.population ?? 0) * 1000) this.takePeopleBtnElement.disabled = true;
                else this.takePeopleBtnElement.disabled = false;
            }
            catch (e) {}
        };
        this.leavePeopleCountElement.oninput = () => {
            let val = this.leavePeopleCountElement.value;
            try {
                let numVal = Number.parseFloat(val);
                console.log(numVal, this.peopleInShip);
                // || numVal > (this.selectedPlanet?.limit ?? 0) - (this.selectedPlanet?.population ?? 0)
                this.leavePeopleBtnElement.disabled = numVal > this.peopleInShip;
            }
            catch (e) {}
        };
        
        this.takePeopleBtnElement.onclick = () => {
            this._connection.sendPacket(packetCode.TAKEPPL, {
                count: Number.parseFloat(this.takePeopleCountElement.value),
            });
        };
        this.leavePeopleBtnElement.onclick = () => {
            this._connection.sendPacket(packetCode.LEAVEEPPL, {
                count: Number.parseFloat(this.leavePeopleCountElement.value),
            });
        };

        this._connection.onPacket<syncPosPacketData>(packetCode.SYNCPOS).subscribe(v => this.onSyncMov(v.data));
        this._connection.onPacket<syncEngPacketData>(packetCode.SYNCENG).subscribe(v => this.onSyncEng(v.data));
        this._connection.onPacket<newPlayerPacketData>(packetCode.NEWPLAYER).subscribe(v => this.onNewPlayer(v.data));
        this._connection.onPacket<delPlayerPacketData>(packetCode.DELPLAYER).subscribe(v => this.onDelPlayer(v.data));
        this._connection.onPacket<movePacketData>(packetCode.MOVE).subscribe(v => this.onMovePlayer(v.data));
        this._connection.onPacket<newPlanetPacketData>(packetCode.NEWPLANET).subscribe(v => this.onNewPlanet(v.data));
        this._connection.onPacket<ownPlanetPacketData>(packetCode.OWNPLANET).subscribe(v => this.onOwnPlanet(v.data));
        this._connection.onPacket<disownPlanetPacketData>(packetCode.DISOWNPLANET).subscribe(v => this.onDisownPlanet(v.data));
        this._connection.onPacket<syncPlanetPacketData>(packetCode.SYNCPLANET).subscribe(v => this.onSyncPlanet(v.data));
        this._connection.onPacket<selectPlanetPacketData>(packetCode.SELECTPLANET).subscribe(v => this.onSelectPlanet(v.data));
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