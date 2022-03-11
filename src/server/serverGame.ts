import * as ws from "websocket";
import { packetConnection } from "../common/packetConnection";
import { packetCode } from "../common/packets";
import { player } from "../common/player";
import { serverPlanet } from "./serverPlanet";
import { serverPlayer } from "./serverPlayer";

export class serverGame {
    public _players: serverPlayer[] = [];
    public _planets: serverPlanet[] = [];

    public update(delta: number) {
        this._players.forEach(v => {
            (v as serverPlayer).update(delta);
            this._players.forEach(other => {
                if (other.id === v.id) return;
                (other as serverPlayer)._connection.sendPacket(packetCode.MOVE, {
                    playerId: v.id,
                    newLocation: v.location,
                    newDirection: v.direction,
                });
            });
            (v as serverPlayer).sync();
        });
    }

    public login(connection: packetConnection, name: string): player | null {
        if (this._players.find(v => v.name === name)) return null;
        
        const player = new serverPlayer(name, connection);

        this._players.forEach(v => (v as serverPlayer)._connection.sendPacket(packetCode.NEWPLAYER, {
            playerId: player.id,
            name: player.name,
            location: player.location,
            direction: player.direction,
        }));

        this._players.push(player);
        return player;
    }
    public async logout(player: serverPlayer, reason?: string | undefined): Promise<void> {
        this._players = this._players.filter(v => {
            return v.id !== player.id;
        });
        this._players.forEach(v => (v as serverPlayer)._connection.sendPacket(packetCode.DELPLAYER, {
            playerId: player.id,
        }));
        if (!player._connection.connection.closed) {
            if (reason) await player._connection.sendPacket(packetCode.KICK, { message: reason });
            player._connection.close();
        }
    }
    public getPlayer(id: number): player | null {
        return this._players.find(v => v.id === id) ?? null;
    }
}