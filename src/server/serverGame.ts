import * as ws from "websocket";
import { game } from "../common/game";
import { packetConnection } from "../common/packetConnection";
import { packetCode } from "../common/packets";
import { player } from "../common/player";
import { serverPlayer } from "./serverPlayer";

export class serverGame extends game {
    public get delta(): number {
        throw new Error("Method not implemented.");
    }

    public login(connection: packetConnection, name: string): player | null {
        if (this.getPlayer(name)) return null;

        const player = new serverPlayer(name, connection);
        this.players.push(player);
        return player;
    }
    public async logout(player: serverPlayer, reason?: string | undefined): Promise<void> {
        if (reason) await player._connection.sendPacket(packetCode.KICK, { message: reason });
        player._connection.close();
    }
}