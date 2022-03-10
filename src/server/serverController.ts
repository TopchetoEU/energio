import { serverGame } from "./serverGame";
import * as ws from "websocket";
import * as http from "http";
import { promisify } from "util";
import { player } from "../common/player";
import { rotationDirection, serverPlayer } from "./serverPlayer";
import { packet, packetConnection } from "../common/packetConnection";
import { logoffPacketData, packetCode } from "../common/packets";
import { Observable, TimeoutError } from "rxjs";
import { controlPacketData, controlType, loginPacketData } from "../common/packets/client";
import { syncPosPacketData } from "../common/packets/server";

interface context {
    connection: ws.connection;
    player?: serverPlayer,
}

const TIMEOUT = 20000;

export class serverController {
    private game: serverGame;
    private httpServer: http.Server;
    private wsServer: ws.server;

    private onControl(player: serverPlayer): (packet: packet<controlPacketData>) => void {
        return packet => {
            if (packet.data.type === controlType.Forward) player.moving = packet.data.starting;
            else if (packet.data.starting) {
                if (packet.data.type === controlType.Left) player.rotationDirection = rotationDirection.LEFT;
                else if (packet.data.type === controlType.Right) player.rotationDirection = rotationDirection.RIGHT;
            }
            else player.rotationDirection = rotationDirection.NONE;
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
            const con = new packetConnection(req.accept(), TIMEOUT);
            try {
                const packet = await con.oncePacket<loginPacketData>(packetCode.LOGIN);

                let player = this.game.login(con, packet.data.name) as serverPlayer;

                if (!player)
                    con.sendError("Player already logged in", "Try changing your username.");
                else {
                    await con.sendPacket(packetCode.INIT, {
                        location: player.location,
                        rotation: player.direction,
                    });

                    con.onPacket<logoffPacketData>(packetCode.LOGOFF).subscribe(this.onLogoff(player));
                    con.onPacket<controlPacketData>(packetCode.CONTROL).subscribe(this.onControl(player));
                }
            }
            catch (e: any) {
                con.sendError(e.message ?? 'Generic error.', e.description);
                con.connection.close();
                console.log("User failed to provide correct packages.");
            }
        });
    }
}
