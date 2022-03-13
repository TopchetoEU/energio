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
import { player, playersOwner } from "../common/player";
import { planet, planetsOwner } from "../common/planet";
import { arrayProperty } from "../common/props/property";
import { tickPacketData } from "../common/packets/server";
import { arrayChangeTracker } from "../common/props/changeTracker";

interface context {
    connection: ws.connection;
    player?: serverPlayer,
}

const TIMEOUT = 2000;

export class serverController implements playersOwner, planetsOwner {
    public planets = new arrayProperty<planet>();
    public players = new arrayProperty<player>();

    private planetsTracker = new arrayChangeTracker(this.planets);
    private playersTracker = new arrayChangeTracker(this.players);
    private httpServer: http.Server;
    private wsServer: ws.server;

    private onControl(player: serverPlayer): (packet: controlPacketData) => void {
        return packet => {
            if (packet.type === controlType.Forward) player.moving.value = packet.starting;
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
        return async () => {
            await this.logout(player);
            player.connection.connection.close();
        };
    }
    private onShipControl(player: serverPlayer): (packet: shipControlPacketData) => void {
        return packet => {
            if (packet.count <= 0) return;
            if (!player.selectedPlanet.value) return;

            let planet = player.selectedPlanet.value;

            if (packet.leave) {
                if (planet.owner.value && planet.owner.value !== player) {
                    player.connection.sendError("Players may be left only at owned colonies or non-colonized planets.");
                    return;
                }

                packet.count = Math.min(planet.limit - planet.population.value, player.peopleAboard.value, packet.count);

                planet.population.value += packet.count;
                player.peopleAboard.value -= packet.count;
            }
            else {
                packet.count = Math.min(planet.population.value, packet.count);
                
                planet.population.value -= packet.count;
                player.peopleAboard.value += packet.count;
            }
        };
    }

    private genTick(player: serverPlayer): tickPacketData {
        const planetsChange = this.planetsTracker.changeDescriptor;
        const playersChange = this.playersTracker.changeDescriptor;
        return {
            delta: this.delta,
            newPlayers: playersChange.added.map(v => (v as serverPlayer).creationData),
            newPlanets: planetsChange.added.map(v => (v as serverPlanet).creationData),
            deletedPlayers: playersChange.removed.map(v => v.id),
            deletedPlanets: planetsChange.removed.map(v => v.id),
            selectedPlanetId: player.selectedPlanet.value?.id ?? -1,
            updatedPlanets: this.planets.value.map(v => ({ id: v.id, changes: (v as serverPlanet).tracker.changeDescriptor })),
            updatedPlayers: this.players.value.map(v => ({ id: v.id, changes: (v as serverPlayer).tracker.changeDescriptor })),
        };
    }
    private genInitTick(player: serverPlayer): tickPacketData {
        const planetsChange = this.planets.value;
        const playersChange = this.players.value;

        return {
            delta: this.delta,
            newPlayers: playersChange.map(v => (v as serverPlayer).creationData),
            newPlanets: planetsChange.map(v => (v as serverPlanet).creationData),
            deletedPlayers: playersChange.map(v => v.id),
            deletedPlanets: planetsChange.map(v => v.id),
            selectedPlanetId: player.selectedPlanet.value?.id ?? -1,
            updatedPlanets: this.planets.value.map(v => ({ id: v.id, changes: (v as serverPlanet).tracker.initDescriptor })),
            updatedPlayers: this.players.value.map(v => ({ id: v.id, changes: (v as serverPlayer).tracker.initDescriptor })),
        };
    }

    private update() {
        this.players.forEach(v => {
            (v as serverPlayer).update(this.delta);
        });
        this.planets.forEach(v => {
            (v as serverPlanet).update(this.delta);
        });
    }

    private async syncOne(player: serverPlayer) {
        player.connection.sendPacket(packetCode.TICK, this.genTick(player));
    }
    private async init(player: serverPlayer) {
        player.connection.sendPacket(packetCode.INIT, { selfId: player.id });
        player.connection.sendPacket(packetCode.TICK, this.genInitTick(player));
    }

    private async sync() {
        for (let v of this.players.value) {
            this.syncOne(v as serverPlayer);
        }
        this.planetsTracker.clearChanges();
        this.playersTracker.clearChanges();

        this.planets.forEach(v => (v as serverPlanet).tracker.clearChanges());
        this.players.forEach(v => (v as serverPlayer).tracker.clearChanges());
    }

    private async login(connection: packetConnection, name: string, location: vector, direction: number): Promise<serverPlayer> {
        if (this.players.value.find(v => v.name === name)) throw Error("Already logged in.");

        const player = new serverPlayer(this, name, connection, location, direction);
        this.players.add(player);

        this.init(player);

        return player;
    }
    private async logout(player: serverPlayer, reason?: string | undefined): Promise<void> {
        this.players.removeIf(v => v.id === player.id);

        for (let planet of player.ownedPlanets.value) {
            planet.owner.value = undefined;
        }

        if (!player.connection.connection.closed) {
            if (reason) await player.connection.sendPacket(packetCode.KICK, { message: reason });
            player.connection.close();
        }
    }
    public getPlayer(id: number): player | null {
        return this.players.value.find(v => v.id === id) ?? null;
    }

    private getPlanetLocation() {
        let loc: vector = vector.zero;

        // return loc;

        for (let startLoc of this.planets.value.map(v => v.location)) {
            let ok = false;

            ok = true;
            let dir = Math.random() * 360;

            for (let i = 0; i < 360; i += 1) {
                loc = startLoc.add(vector.fromDirection(Math.random() * 1500).multiply(Math.random() * 500));
                dir += 1;
                
                for (let planet of this.planets.value) {
                    let dist = planet.location.distance(loc);
                    if (dist < 100) {
                        ok = false;
                        break;
                    }
                }
                if (ok) return loc;
            }
        }

        return loc;
    }

    constructor(port: number, config: gameConfig, private delta: number) {
        this.httpServer = http.createServer();
        this.httpServer.on('listening', () => console.log("Listening to :8001"));
        this.httpServer.on('error', err => console.error(err));
        this.httpServer.listen(port);
        this.wsServer = new ws.server({
            httpServer: this.httpServer
        });

        config.planets.forEach(v => {
            this.planets.add(new serverPlanet({ ...v, location: this.getPlanetLocation() }, this));
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
                    
                    let planet = new serverPlanet({ ...config.starter, location: loc }, this);
                    this.planets.add(planet);
                    planet.population.value = planet.limit;
                    planet.owner.value = player;

                    socket.onClose.pipe(first()).subscribe(() => this.logout(player as serverPlayer));
                    con.onPacket<logoffPacketData>(packetCode.LOGOFF).subscribe(v => this.onLogoff(player)(v.data));
                    con.onPacket<controlPacketData>(packetCode.CONTROL).subscribe(v => this.onControl(player)(v.data));
                    con.onPacket<shipControlPacketData>(packetCode.SHIPCONTROL).subscribe(v => this.onShipControl(player)(v.data));
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
            this.update();
            this.sync();
        }, delta * 1000);
    }
}
