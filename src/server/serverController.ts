import * as ws from "websocket";
import * as http from "http";
import { serverPlayer } from "./serverPlayer";
import { packet, packetConnection } from "../common/packetConnection";
import { packetCode } from "../common/packets";
import { controlPacketData, controlType, loginPacketData, logoutPacketData as logoffPacketData, shipControlPacketData } from "../common/packets/client";
import { serverSocket } from "./serverSocket";
import { connect, first } from "rxjs";
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

    private onControl(player: serverPlayer): (packet: controlPacketData) => void {
        return packet => {
            if (packet.type === controlType.Forward) player.moving = packet.starting;
            else if (packet.starting) {
                if (packet.type === controlType.Left) player.rotationDirection--;
                else if (packet.type === controlType.Right) player.rotationDirection++;
            }
            else {
                if (packet.type === controlType.Left) player.rotationDirection++;
                else if (packet.type === controlType.Right) player.rotationDirection--;
            }

            if (player.rotationDirection < -1) player.rotationDirection = -1;
            if (player.rotationDirection > 1) player.rotationDirection = 1;
        };
    }
    private onLogoff(player: serverPlayer): (packet: logoffPacketData) => void {
        return () => {
            this.logout(player);
            player.connection.connection.close();
        };
    }
    private onShipControl(player: serverPlayer): (packet: shipControlPacketData) => void {
        return packet => {
            if (packet.count <= 0) return;
            if (!player._selectedPlanet) return;

            if (packet.leave) {
                if (player._selectedPlanet.owner && player._selectedPlanet.owner !== player) {
                    player.connection.sendError("Players may be left only at owned colonies or non-colonized planets.");
                    return;
                }

                let limit = player._selectedPlanet.limit - player._selectedPlanet.population;
                if (player.peopleAboard > limit) player.peopleAboard = limit;

                player._selectedPlanet.population += 
            }
            // if (player._selectedPlanet.population < packet.count) packet.count = player._selectedPlanet.population;
        };
    }

    public _players: serverPlayer[] = [];
    public _planets: serverPlanet[] = [];

    public update(delta: number) {
        this._players.forEach(v => {
            (v as serverPlayer).update(delta, this);
            this._players.forEach(other => {
                if (other.id === v.id) return;
                (other as serverPlayer).connection.sendPacket(packetCode.MOVE, {
                    playerId: v.id,
                    newLocation: v.location,
                    newDirection: v.direction,
                });
            });
            (v as serverPlayer).sync(this._planets);
        });
        this._planets.forEach(v => {
            v.sync(this._players);
        });
    }

    private createPlanetFromConf(conf: planetConfig): serverPlanet {
        let planet = new serverPlanet(conf);
        this._players.forEach(v => (v as serverPlayer).connection.sendPacket(packetCode.NEWPLANET, { ...conf, id: planet.id }));
        this._planets.push(planet);
        return planet;
    }
    // private removePlanet(planet: serverPlanet) {
    //     this._players.forEach(v => (v as serverPlayer)._connection.sendPacket(packetCode.DELPLANET, { id: planet.id }));
    //     this._planets = this._planets.filter(v => v.id === planet.id);
    // }

    public async ownPlanet(planet: serverPlanet, player: serverPlayer): Promise<void> {
        if (planet.owner) {
            this.disownPlanet(planet);
        }
        for (let v of this._players) {
            await v.connection.sendPacket(packetCode., { 
                playerId: player.id,
                planetId: planet.id
            });
        }
        planet.owner = player;
        player.ownedPlanets.push(planet);
    }
    public async disownPlanet(planet: serverPlanet): Promise<void> {
        if (!planet.owner) return;
        for (let v of this._players) {
            await v.connection.sendPacket(packetCode.DISOWNPLANET, { 
                planetId: planet.id
            });
        }
        planet.owner = undefined;
        planet.population = 0;
        await planet.sync(this._players);
    }

    private async login(connection: packetConnection, name: string, location: vector, direction: number): Promise<serverPlayer> {
        if (this._players.find(v => v.name === name)) throw Error("Already logged in.");
        
        const player = new serverPlayer(name, connection, location, direction);

        await player.connection.sendPacket(packetCode.INIT, {
            location: location,
            rotation: direction,
            selfId: player.id,
        });

        for (let _player of this._players) {
            await player.connection.sendPacket(packetCode.NEWPLAYER, {
                playerId: _player.id,
                name: _player.name,
                location: _player.location,
                direction: _player.direction,
            });
            await _player.connection.sendPacket(packetCode.NEWPLAYER, {
                playerId: player.id,
                name: player.name,
                location: player.location,
                direction: player.direction,
            });
        }

        for (let planet of this._planets) {
            await player.connection.sendPacket(packetCode.NEWPLANET, {
                colonySrc: planet.colonySrc,
                normalSrc: planet.normalSrc,
                selectedSrc: planet.selectedSrc,
                name: planet.name,
                prodPerCapita: planet.productionPerCapita,
                id: planet.id,
                limit: planet.limit,
                location: planet.location,
            });
            if (planet.owner) {
                await player.connection.sendPacket(packetCode.OWNPLANET, {
                    planetId: planet.id,
                    playerId: planet.owner.id,
                });
            }
        }

        this._players.push(player);
        return player;
    }

    private async logout(player: serverPlayer, reason?: string | undefined): Promise<void> {
        this._players = this._players.filter(v => {
            return v.id !== player.id;
        });

        for (let planet of player.ownedPlanets) {
            await this.disownPlanet(planet as serverPlanet);
        }
        this._players.forEach(v => (v as serverPlayer).connection.sendPacket(packetCode.DELPLAYER, {
            playerId: player.id,
        }));
        if (!player.connection.connection.closed) {
            if (reason) await player.connection.sendPacket(packetCode.KICK, { message: reason });
            player.connection.close();
        }
    }
    public getPlayer(id: number): player | null {
        return this._players.find(v => v.id === id) ?? null;
    }

    private getPlanetLocation() {
        let loc: vector = vector.zero;

        for (let startLoc of this._planets.map(v => v.location)) {
            let ok = false;

            ok = true;
            let dir = Math.random() * 360;

            for (let i = 0; i < 360; i += 1) {
                loc = startLoc.add(vector.fromDirection(Math.random() * 1500).multiply(Math.random() * 1500));
                dir += 1;
                
                for (let planet of this._planets) {
                    let dist = planet.location.distance(loc);
                    if (dist < 750) {
                        ok = false;
                        break;
                    }
                }
                if (ok) return loc;
            }
        }

        return loc;
    }

    constructor(port: number, config: gameConfig) {
        this.httpServer = http.createServer();
        this.httpServer.on('listening', () => console.log("Listening to :8001"));
        this.httpServer.on('error', err => console.error(err));
        this.httpServer.listen(port);
        this.wsServer = new ws.server({
            httpServer: this.httpServer
        });

        config.planets.forEach(v => {
            this.createPlanetFromConf({ ...v, location: this.getPlanetLocation() });
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
                    let player: serverPlayer;
                    let loc = this.getPlanetLocation();
                    let rot = Math.random() * 360;

                    try {
                        player = await this.login(con, packet.data.name, loc, rot);
                    }
                    catch {
                        await con.sendError("Player already logged in", "Try changing your username.");
                        con.close();
                        return;
                    }

                    socket.onClose.pipe(first()).subscribe(() => {
                        this.logout(player as serverPlayer);
                    });

                    let planet = this.createPlanetFromConf({ ...config.starter, location: loc });
                    planet.population = planet.limit;
                    await planet.sync(this._players);
                    await this.ownPlanet(planet, player);

                    con.onPacket<logoffPacketData>(packetCode.LOGOFF).subscribe(this.onLogoff(player));
                    con.onPacket<controlPacketData>(packetCode.CONTROL).subscribe(this.onControl(player));
                    con.onPacket<shipControlPacketData>(packetCode.SHIPCONTROL).subscribe(this.onShipControl(player));
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
