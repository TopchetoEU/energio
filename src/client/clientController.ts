import { fromEvent, Subscription } from "rxjs";
import { packetConnection } from "../common/packetConnection";
import { packetCode } from "../common/packets";
import { controlType } from "../common/packets/client";
import { delPlayerPacketData, initPacketData, movePacketData, newPlayerPacketData, syncPosPacketData } from "../common/packets/server";
import { socket } from "../common/socket";
import { vector } from "../common/vector";
import { clientPlayer } from "./clientPlayer";

const TIMEOUT = 2000;
const onKeydown = fromEvent<KeyboardEvent>(document, 'keydown');
const onKeyup = fromEvent<KeyboardEvent>(document, 'keyup');
const SCALE = 1;

export class clientController {
    private _connection: packetConnection;
    public get delta(): number {
        throw new Error("Method not implemented.");
    }
    private subscribers: Subscription[] = [];
    private players: clientPlayer[] = [];

    public location: vector;
    public direction: number;
    public id: number;

    private gameElement = document.getElementById('game') as HTMLDivElement;
    private playerElement = document.getElementById('self') as HTMLDivElement;

    private updateElements() {
        this.gameElement.style.transform = `rotate(${-this.direction}deg) translate(${-this.location.x}px, ${-this.location.y}px)`;
        this.playerElement.style.transform = `translate(${this.location.x}px, ${this.location.y}px) rotate(${this.direction}deg)`;
    }

    public constructor(packet: initPacketData, connection: packetConnection, name: string) {
        this._connection = connection;
        this.location = new vector(packet.location.x, packet.location.y);
        this.direction = packet.rotation;
        this.id = packet.selfId;
    
        this.subscribers.push(
            onKeydown.subscribe(kb => {
                if (kb.repeat) return;
                switch (kb.code) {
                    case "KeyW":
                    case "ArrowUp":
                        this._connection.sendPacket(packetCode.CONTROL, { starting: true, type: controlType.Forward });
                        break;
                    case "KeyA":
                    case "ArrowLeft":
                        this._connection.sendPacket(packetCode.CONTROL, { starting: true, type: controlType.Left });
                        break;
                    case "KeyD":
                    case "ArrowRight":
                        this._connection.sendPacket(packetCode.CONTROL, { starting: true, type: controlType.Right });
                        break;
                }
            }),
            onKeyup.subscribe(kb => {
                switch (kb.code) {
                    case "KeyW":
                    case "ArrowUp":
                        this._connection.sendPacket(packetCode.CONTROL, { starting: false, type: controlType.Forward });
                        break;
                    case "KeyA":
                    case "ArrowLeft":
                        this._connection.sendPacket(packetCode.CONTROL, { starting: false, type: controlType.Left });
                        break;
                    case "KeyD":
                    case "ArrowRight":
                        this._connection.sendPacket(packetCode.CONTROL, { starting: false, type: controlType.Right });
                        break;
                }
            }),
        );

        this._connection.onPacket<syncPosPacketData>(packetCode.SYNCPOS).subscribe(v => {
            this.location = new vector(v.data.location.x, v.data.location.y);
            this.direction = v.data.direction;
            this.updateElements();
        });
        this._connection.onPacket<newPlayerPacketData>(packetCode.NEWPLAYER).subscribe(packet => {
            this.players.push(new clientPlayer(packet.data, this));
        });
        this._connection.onPacket<delPlayerPacketData>(packetCode.DELPLAYER).subscribe(packet => {
            this.players = this.players.filter(v => {
                if (v.id === packet.data.playerId) {
                    v.element.remove();
                    return false;
                }
                return true;
            });
        });
        this._connection.onPacket<movePacketData>(packetCode.MOVE).subscribe(packet => {
            if (packet.data.playerId === this.id) return;
            this.players.find(v => v.id === packet.data.playerId)?.update(packet.data);
        });
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