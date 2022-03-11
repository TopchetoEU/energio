import * as ws from "websocket";
import * as http from "http";
import { serverPlayer } from "./serverPlayer";
import { packet, packetConnection } from "../common/packetConnection";
import { logoffPacketData, packetCode } from "../common/packets";
import { controlPacketData, controlType, loginPacketData } from "../common/packets/client";
import { serverSocket } from "./serverSocket";
import { first } from "rxjs";
import { gameConfig, planetConfig } from "./gameConfig";
import { vector } from "../common/vector";
import { serverPlanet } from "./serverPlanet";
import { player } from "../common/player";

interface context {
    connection: ws.connection;
    player?: serverPlayer,
}

const TIMEOUT = 2000;

export class serverController {
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
            this.logout(player);
            player._connection.connection.close();
        };
    }


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

    private createPlanetFromConf(conf: planetConfig): serverPlanet {
        let planet = new serverPlanet(conf);
        this._players.forEach(v => (v as serverPlayer)._connection.sendPacket(packetCode.NEWPLANET, { ...conf, id: planet.id }));
        this._planets.push(planet);
        return planet;
    }
    private removePlanet(planet: serverPlanet) {
        this._players.forEach(v => (v as serverPlayer)._connection.sendPacket(packetCode.DELPLANET, { id: planet.id }));
        this._planets = this._planets.filter(v => v.id === planet.id);
    }

    private ownPlanet(planet: serverPlanet, player: serverPlayer) {
        if (planet.owner) {
            this.disownPlanet(planet);
        }
        this._players.forEach(v => (v as serverPlayer)._connection.sendPacket(packetCode.OWNPLANET, { 
            playerId: player.id,
            planetId: planet.id
        }));
        planet.owner = player;
    }
    private disownPlanet(planet: serverPlanet) {
        if (!planet.owner) return;
        this._players.forEach(v => (v as serverPlayer)._connection.sendPacket(packetCode.DISOWNPLANET, { 
            planetId: planet.id
        }));
        planet.owner = undefined;
        planet.population = 0;
    }

    private login(connection: packetConnection, name: string): serverPlayer | null {
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
    private async logout(player: serverPlayer, reason?: string | undefined): Promise<void> {
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

    constructor(port: number, config: gameConfig) {
        this.httpServer = http.createServer();
        this.httpServer.on('listening', () => console.log("Listening to :8001"));
        this.httpServer.on('error', err => console.error(err));
        this.httpServer.listen(port);
        this.wsServer = new ws.server({
            httpServer: this.httpServer
        });

        this.wsServer.on('request', async req => {
            const socket = new serverSocket(req.accept());
            const con = new packetConnection(socket, TIMEOUT);

            try {
                const packet = await con.oncePacket<loginPacketData>(packetCode.LOGIN);

                if (!/^(\w{3,16})$/g.test(packet.data.name)) {
                    con.sendError("Invalid name given", "Names must be alphanumeric with underscores, from 3 to 16 characters in length.");
                    con.close();
                }
                else {
                    let player = this.login(con, packet.data.name);
                
                    if (!player) {
                        await con.sendError("Player already logged in", "Try changing your username.");
                        con.close();
                        return;
                    }
                    else {
                        let p = player as serverPlayer;
                        let startLoc = vector.zero;
                        if (this._planets.length > 0) this._planets[this._planets.length - 1].location;
                        let loc: vector;
                        let ok = false;
                        let i = 0;
                        do {
                            ok = true;
                            loc = startLoc.add(vector
                                .fromDirection(Math.random() * Math.PI * 2, true)
                                .multiply(Math.random() * 5000));
                            i++;
                            if (i > 1000) continue;
                            if (this._planets.find(v => {
                                let dist = v.location.distance(loc);
                                return dist < 700 || dist > 2400;
                            })) ok = false;
                        } while(!ok);
                        let rot = Math.random() * 360;
                        socket.onClose.pipe(first()).subscribe(() => this.logout(p as serverPlayer));

                        player.location = loc;
                        player.direction = rot;

                        await con.sendPacket(packetCode.INIT, {
                            location: loc,
                            rotation: rot,
                            selfId: player.id,
                        });
    
                        this._players.filter(v => v.id != p.id).forEach(v => p._connection.sendPacket(packetCode.NEWPLAYER, {
                            playerId: v.id,
                            name: v.name,
                            location: v.location,
                            direction: v.direction,
                        }));


                        let planet = this.createPlanetFromConf({ ...config.starter, location: loc });
                        this.ownPlanet(planet, player);
    
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
            this.update(0.1);
        }, 100);
    }
}
