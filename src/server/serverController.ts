import { serverGame } from "./serverGame";
import * as ws from "websocket";
import * as http from "http";
import { rotationDirection, serverPlayer } from "./serverPlayer";
import { packet, packetConnection } from "../common/packetConnection";
import { logoffPacketData, packetCode } from "../common/packets";
import { controlPacketData, controlType, loginPacketData } from "../common/packets/client";
import { serverSocket } from "./serverSocket";
import { first } from "rxjs";
import { movePacketData, newPlayerPacketData } from "../common/packets/server";

interface context {
    connection: ws.connection;
    player?: serverPlayer,
}

const TIMEOUT = 2000;

export class serverController {
    private game: serverGame;
    private httpServer: http.Server;
    private wsServer: ws.server;

    private onControl(player: serverPlayer): (packet: packet<controlPacketData>) => void {
        return packet => {
            if (packet.data.type === controlType.Forward) player.moving = packet.data.starting;
            else if (packet.data.starting) {
                if (packet.data.type === controlType.Left) player.rotationDirection--;
                else if (packet.data.type === controlType.Right) player.rotationDirection++;
            }
            else {
                if (packet.data.type === controlType.Left) player.rotationDirection++;
                else if (packet.data.type === controlType.Right) player.rotationDirection--;
            }

            if (player.rotationDirection < -1) player.rotationDirection = -1;
            if (player.rotationDirection > 1) player.rotationDirection = 1;
        };
    }
    private onLogoff(player: serverPlayer): (packet: packet<logoffPacketData>) => void {
        return () => {
            this.game.logout(player);
            player._connection.connection.close();
        };
    }

    constructor(port: number) {
        this.httpServer = http.createServer();
        this.httpServer.on('listening', () => console.log("Listening to :8001"));
        this.httpServer.on('error', err => console.error(err));
        this.httpServer.listen(port);
        this.wsServer = new ws.server({
            httpServer: this.httpServer
        });
        this.game = new serverGame();

        this.wsServer.on('request', async req => {
            const socket = new serverSocket(req.accept());
            const con = new packetConnection(socket, TIMEOUT);

            try {
                const packet = await con.oncePacket<loginPacketData>(packetCode.LOGIN);

                console.log(/^(\w{3,16})$/g.test(packet.data.name));
                if (!/^(\w{3,16})$/g.test(packet.data.name)) {
                    con.sendError("Invalid name given", "Names must be alphanumeric with underscores, from 3 to 16 characters in length.");
                    con.close();
                }
                else {
                    console.log(packet.data.name);
                    console.log(this.game._players.map(v => v.name));
                    let player = this.game.login(con, packet.data.name) as serverPlayer;
                
                    if (!player) {
                        con.sendError("Player already logged in", "Try changing your username.");
                        con.close();
                    }
                    else {
                        socket.onClose.pipe(first()).subscribe(() => this.game.logout(player));
                        await con.sendPacket(packetCode.INIT, {
                            location: player.location,
                            rotation: player.direction,
                            selfId: player.id,
                        });
    
                        this.game._players.filter(v => v.id != player.id).forEach(v => player._connection.sendPacket(packetCode.NEWPLAYER, {
                            playerId: v.id,
                            name: v.name,
                            location: v.location,
                            direction: v.direction,
                        }));
    
                        con.onPacket<logoffPacketData>(packetCode.LOGOFF).subscribe(this.onLogoff(player));
                        con.onPacket<controlPacketData>(packetCode.CONTROL).subscribe(this.onControl(player));
                    }
                }
            }
            catch (e: any) {
                console.log(e);
                con.sendError(e.message ?? 'Generic error.', e.description);
                con.connection.close();
                console.log("User failed to provide correct packages.");
            }
        });

        setInterval(() => {
            this.game.update(0.1);
        }, 100);
    }
}
