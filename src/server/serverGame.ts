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

    public update(delta: number) {
        this.players.forEach(v => {
            (v as serverPlayer).update(delta);
            (v as serverPlayer).syncPos();
        });
    }

    public login(connection: packetConnection, name: string): player | null {
        if (this.getPlayer(name)) return null;
        
        const player = new serverPlayer(name, connection);

        this.players.forEach(v => (v as serverPlayer)._connection.sendPacket(packetCode.NEWPLAYER, {
            playerId: player.id,
            name: player.name,
            location: player.location,
            direction: player.direction,
        }));

        this.playerList.push(player);
        return player;
    }
    public async logout(player: serverPlayer, reason?: string | undefined): Promise<void> {
        this.playerList = this.playerList.filter(v => {
            return v.id !== player.id;
        });
        this.players.forEach(v => (v as serverPlayer)._connection.sendPacket(packetCode.DELPLAYER, {
            playerId: player.id,
        }));
        if (!player._connection.connection.closed) {
            if (reason) await player._connection.sendPacket(packetCode.KICK, { message: reason });
            player._connection.close();
        }
    }
}