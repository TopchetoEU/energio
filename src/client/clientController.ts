import { fromEvent, Subscription } from "rxjs";
import { createModuleResolutionCache, validateLocaleAndSetLanguage } from "typescript";
import { packetConnection } from "../common/packetConnection";
import { packetCode } from "../common/packets";
import { controlType } from "../common/packets/client";
import { delPlanetPacketData, delPlayerPacketData, initPacketData, movePacketData, newPlanetPacketData, newPlayerPacketData, ownPlanetPacketData, syncEngPacketData, syncPosPacketData } from "../common/packets/server";
import { player } from "../common/player";
import { socket } from "../common/socket";
import { vector } from "../common/vector";
import { energyUnit } from "../server/energy";
import { planetConfig } from "../server/gameConfig";
import { clientPlanet } from "./clientPlanet";
import { clientPlayer } from "./clientPlayer";

const TIMEOUT = 2000;
const onKeydown = fromEvent<KeyboardEvent>(document, 'keydown');
const onKeyup = fromEvent<KeyboardEvent>(document, 'keyup');
const SCALE = 1;

export class clientController extends player implements energyUnit {
    private _connection: packetConnection;
    private subscribers: Subscription[] = [];
    private players: clientPlayer[] = [];
    private planets: clientPlanet[] = [];
    private ownPlanets: clientPlanet[] = [];

    private _consumption: number = 0;
    private _production: number = 0;

    private gameElement = document.getElementById('game') as HTMLDivElement;
    private playerElement = document.getElementById('self') as HTMLDivElement;
    private percentElement = document.getElementById('engpercent') as HTMLSpanElement;
    private energyBarElement = document.getElementById('energybar') as HTMLDivElement;

    private updateElements() {
        this.gameElement.style.transform = `rotate(${-this.direction}deg) translate(${-this.location.x}px, ${-this.location.y}px)`;
        this.playerElement.style.transform = `translate(${this.location.x}px, ${this.location.y}px) rotate(${this.direction}deg)`;
    }
    private updateBarElements() {
        let percent: number;

        if (this.production === 0) percent = 0;
        else {
            percent = 1 - this.consumption / this.production;
            if (percent < 0) percent = 0;
        }

        let newText = `${percent * 100}% / ${this.production}PW`;
        if (this.percentElement.innerText != newText) this.percentElement.innerText = newText;
        this.energyBarElement.style.width = `${percent * 100}%`;
    }
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
    private onSyncMov(packet: syncPosPacketData) {
        this.location = new vector(packet.location.x, packet.location.y);
        this.direction = packet.direction;
        this.updateElements();
    }
    private onSyncEng(packet: syncEngPacketData) {
        this._consumption = packet.consumption;
        this._production = packet.production;
        this.updateBarElements();
    }
    private onNewPlayer(packet: newPlayerPacketData) {
        this.players.push(new clientPlayer(packet, this));
    }
    private onDelPlayer(packet: delPlayerPacketData) {
        this.players = this.players.filter(v => {
            if (v.id === packet.playerId) {
                v.element.remove();
                return false;
            }
            return true;
        });
    }
    private onMovePlayer(packet: movePacketData) {
        if (packet.playerId === this.id) return;
        this.players.find(v => v.id === packet.playerId)?.update(packet);
    }
    private onNewPlanet(data: newPlanetPacketData): void {
        let planet = new clientPlanet(data);
        this.planets.push(planet);
        planet.updateElement();
    }
    private getPlayer(id: number) {
        if (id === this.id) return this;
        return this.players.find(v => v.id === id);
    }
    private getPlanet(id: number) {
        return this.planets.find(v => v.id === id);
    }
    private onOwnPlanet(data: ownPlanetPacketData): void {
        let planet = this.getPlanet(data.planetId);
        let player = this.getPlayer(data.playerId);
        if (planet) {
            this.planets.push(planet);
            if (player) planet.owner = player;
        }
    }
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

    public constructor(packet: initPacketData, connection: packetConnection, name: string) {
        super(name, packet.selfId, new vector(packet.location.x, packet.location.y), packet.rotation);
        this._connection = connection;
    
        this.subscribers.push(
            onKeydown.subscribe(kb => {
                if (!kb.repeat) this.onKey(kb.code, true);
            }),
            onKeyup.subscribe(kb => this.onKey(kb.code, false)),
        );

        this._connection.onPacket<syncPosPacketData>(packetCode.SYNCPOS).subscribe(v => this.onSyncMov(v.data));
        this._connection.onPacket<syncEngPacketData>(packetCode.SYNCENG).subscribe(v => this.onSyncEng(v.data));
        this._connection.onPacket<newPlayerPacketData>(packetCode.NEWPLAYER).subscribe(v => this.onNewPlayer(v.data));
        this._connection.onPacket<delPlayerPacketData>(packetCode.DELPLAYER).subscribe(v => this.onDelPlayer(v.data));
        this._connection.onPacket<movePacketData>(packetCode.MOVE).subscribe(v => this.onMovePlayer(v.data));
        this._connection.onPacket<newPlanetPacketData>(packetCode.NEWPLANET).subscribe(v => this.onNewPlanet(v.data));
        this._connection.onPacket<ownPlanetPacketData>(packetCode.OWNPLANET).subscribe(v => this.onOwnPlanet(v.data));
    }

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