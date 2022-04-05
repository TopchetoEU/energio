import * as ws from "websocket";
import * as http from "http";
import { serverPlayer } from "./serverPlayer";
import { packetConnection } from "../common/packetConnection";
import { packetCode } from "../common/packets";
import { clientChatPacketData, controlPacketData, controlType, loginPacketData, logoutPacketData as logoffPacketData, shipControlPacketData } from "../common/packets/client";
import { serverSocket } from "./serverSocket";
import { first, merge } from "rxjs";
import { gameConfig } from "./gameConfig";
import { ExtMath, vector } from "../common/vector";
import { serverPlanet } from "./serverPlanet";
import { player, playersOwner } from "../common/player";
import { planet, planetsOwner } from "../common/planet";
import { endEffectPacketData, laserPacketData, planetUpdateData, playerUpdateData, serverChatPacketData, tickPacketData } from "../common/packets/server";
import { register, registerChangeTracker, registerProperty } from "../common/props/register";
import { constructorExtender } from "../common/props/decorators";
import { NIL } from "uuid";
import { physicsEngine } from "./physics/physicsEngine";
import { serverLaser } from "./serverLaser";
import { laserFirer } from "./laserFirer";
import { isEmpty } from "../common/props/changes";

interface context {
    connection: ws.connection;
    player?: serverPlayer,
}

const TIMEOUT = 200000;

@constructorExtender()
export class serverController implements playersOwner, planetsOwner {
    public readonly planets = new register<planet>();
    public readonly players = new register<player>();
    public readonly lasers = new register<serverLaser>();
    public readonly physics = new physicsEngine();
    private chat: serverChatPacketData[] = [];

    private _planetsTracker = new registerChangeTracker(new registerProperty(this.planets, (a, b) => a.id === b.id));
    private _playersTracker = new registerChangeTracker(new registerProperty(this.players, (a, b) => a.id === b.id));
    public readonly httpServer: http.Server;
    public readonly wsServer: ws.server;

    private fireLaser(firer: laserFirer) {
        return () => {
            let laser = firer.createLaser();
            this.lasers.add(laser);
            this.physics.objects.add(laser);

            this.players.forEach(v => (v as serverPlayer).connection.sendPacket(packetCode.EFFECT, {
                type: "laser",
                decay: laser.decay,
                id: laser.id,
                location: laser.location,
                power: laser.power,
                size: laser.size,
                velocity: laser.velocity,
            } as laserPacketData));

            merge(laser.onDecay, laser.onHit).subscribe(v => {
                this.lasers.remove(laser);
                this.physics.objects.remove(laser);
                this.players.forEach(v => (v as serverPlayer).connection.sendPacket(packetCode.ENDEFFECT, {
                    id: laser.id,
                } as endEffectPacketData));
                laser.remove();
            });
        }
    }

    private onControl(player: serverPlayer): (packet: controlPacketData) => void {
        return packet => {
            if (packet.type === controlType.Fire) player.shootingConsumer.active = packet.starting;
            else {
                if (packet.type === controlType.Forward) player.movingConsumer.active = packet.starting;
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
            }
        };
    }
    private onLogoff(player: serverPlayer): (packet: logoffPacketData) => void {
        return async () => {
            await this.logout(player);
            player.connection.connection.close();
        };
    }
    private onShipControl(player: serverPlayer): (packet: shipControlPacketData) => void {
        return async packet => {
            if (packet.count <= 0) return;
            if (!player.selectedPlanet) return;

            let planet = player.selectedPlanet;

            if (player.selectedPlanet.owner !== void 0 && player.selectedPlanet.owner?.id !== player.id) {
                await player.connection.sendError("This is not your planet.", "Don't try to cheese the system");
                return;
            }

            if (packet.leave) {
                if (planet.owner && planet.owner !== player) {
                    player.connection.sendError("Players may be left only at owned colonies or non-colonized planets.");
                    return;
                }

                packet.count = Math.min(planet.limit - planet.population, player.peopleAboard, packet.count);

                planet.population += packet.count;
                player.peopleAboard -= packet.count;

                planet.owner = player;
            }
            else {
                packet.count = Math.min(planet.population, packet.count);
                
                planet.population -= packet.count;
                player.peopleAboard += packet.count;

                if (planet.population < 0.000001) 
                    planet.owner = undefined;
            }
        };
    }
    private onChat(player?: serverPlayer): (packet: clientChatPacketData) => void {
        return async packet => {
            let message = packet.message.trim().substring(0, 128).toUpperCase();

            if (message === '') return;

            let msg = { message: message, name: player?.name };
            this.chat.push(msg);
            if (player) {
                player.chatBubble = message;
                console.log(`[CHAT]: ${player.name.toUpperCase()}: ${message}`);
            }
            else console.log(`[CHAT]: ${message}`);
            this.syncChat(msg);
        };
    }
    private syncChat(msg: serverChatPacketData) {
        this.players.forEach(v => (v as serverPlayer).connection.sendPacket(packetCode.CHAT, msg));
    }

    private genTick(player: serverPlayer): tickPacketData {
        const planetsChange = this._planetsTracker.changeDescriptor;
        const playersChange = this._playersTracker.changeDescriptor;
        playersChange?.added?.map(v => (v as serverPlayer).tracker.initDescriptor).filter(v => v !== void 0);

        let planetUpdate: planetUpdateData = {};
        let playerUpdate: playerUpdateData = {};

        this.planets.forEach(planet => planetUpdate[planet.id] = (planet as serverPlanet).tracker.changeDescriptor);
        this.players.forEach(player => playerUpdate[player.id] = (player as serverPlayer).tracker.changeDescriptor);

        let desc: tickPacketData = {
            delta: this.delta,
            newPlayers: playersChange?.added?.map(v => ({ ...(v as serverPlayer).tracker.initDescriptor, id: v.id })),
            newPlanets: planetsChange?.added?.map(v => ({ ...(v as serverPlanet).tracker.initDescriptor, id: v.id })),
            deletedPlayers: playersChange?.removed?.map(v => v.id),
            deletedPlanets: planetsChange?.removed?.map(v => v.id),
            selectedPlanetId: player.selectedPlanet?.id ?? NIL,
            updatedPlanets: planetUpdate,
            updatedPlayers: playerUpdate,
        };

        if (isEmpty(desc.updatedPlayers)) desc.updatedPlayers = undefined;
        if (isEmpty(desc.updatedPlanets)) desc.updatedPlanets = undefined;

        return desc;
    }
    private genInitTick(player: serverPlayer): tickPacketData {
        const planetsChange = this.planets;
        const playersChange = this.players;

        let desc: tickPacketData = {
            delta: this.delta,
            selectedPlanetId: player.selectedPlanet?.id ?? NIL,
            newPlayers: playersChange.map(v => ({ ...(v as serverPlayer).tracker.initDescriptor, id: v.id })),
            newPlanets: planetsChange.map(v => ({ ...(v as serverPlanet).tracker.initDescriptor, id: v.id })),
        };
    
        if (desc.newPlayers?.length === 0) desc.newPlayers = undefined;
        if (desc.newPlanets?.length === 0) desc.newPlanets = undefined;

        return desc;
    }

    private update() {
        this.physics.update(this.delta);
        this.lasers.forEach(v => {
            v.update(this.delta);
        });
        this.players.forEach(v => {
            let p = (v as serverPlayer);
            p.update(this.delta, this.fireLaser(p));
        });
        this.planets.forEach(v => {
            (v as serverPlanet).update(this.delta);
        });
    }

    private async syncOne(player: serverPlayer) {
        try {
            await player.connection.sendPacket(packetCode.TICK, this.genTick(player));
        }
        catch {
            console.log(`Couldn't send packet to ${player.name}.`);
        }
    }
    private async init(player: serverPlayer) {
        await player.connection.sendPacket(packetCode.INIT, { selfId: player.id });
        await player.connection.sendPacket(packetCode.TICK, this.genInitTick(player));
        this.chat.forEach(v => player.connection.sendPacket(packetCode.CHAT, v));
    }

    private async sync() {
        for (let v of this.players.array) {
            await this.syncOne(v as serverPlayer);
        }
        this._planetsTracker.reset();
        this._playersTracker.reset();

        this.planets.forEach(v => (v as serverPlanet).tracker.reset());
        this.players.forEach(v => (v as serverPlayer).tracker.reset());
    }

    private async login(connection: packetConnection, name: string, location: vector, direction: number): Promise<serverPlayer> {
        if (this.players.find(v => v.name === name) !== void 0) throw Error("Already logged in.");
        
        const player = new serverPlayer(name, connection, location, direction);
        this.players.add(player);

        await this.init(player);

        this.onChat()({ message:  name + ' joined the game.' });

        return player;
    }
    private async logout(player: serverPlayer, reason?: string | undefined): Promise<void> {
        this.players.removeIf(v => v.id === player.id);

        for (let planet of player.ownedPlanets.array) {
            planet.owner = undefined;
        }

        if (!player.connection.connection.closed) {
            if (reason) await player.connection.sendPacket(packetCode.KICK, { message: reason });
            player.connection.close();
        }

        this.onChat()({ message: player.name + ' left the game.' });
    }
    public getPlayer(id: string): player | null {
        return this.players.find(v => v.id === id) ?? null;
    }

    private getPlanetLocation() {
        let loc: vector = vector.zero;

        for (let startLoc of this.planets.map(v => v.location)) {
            let ok = false;

            ok = true;
            let dir = Math.random() * 360;

            for (let i = 0; i < 360; i += 1) {
                loc = startLoc.add(vector.fromDirection(Math.random() * 1500).multiply(Math.random() * 1500));
                dir += 1;
                
                for (let planet of this.planets.array) {
                    let dist = planet.location.distance(loc);
                    if (dist < 500) {
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
        this.wsServer = new ws.server({
            httpServer: this.httpServer
        });
        this.httpServer.on('listening', () => console.log("Listening to :8001"));
        this.httpServer.on('error', err => console.error(err));
        this.httpServer.listen(port);

        this.players.onAdd.subscribe(v => this.physics.objects.add(v as serverPlayer));
        this.players.onRemove.subscribe(v => this.physics.objects.remove(v as serverPlayer));

        this.planets.onAdd.subscribe(v => this.physics.objects.add(v as serverPlanet));
        this.planets.onRemove.subscribe(v => this.physics.objects.remove(v as serverPlanet));

        for (let planet of config.planets) {
            this.planets.add(new serverPlanet({ ...planet, location: this.getPlanetLocation() }));
        }

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
                        player = await this.login(con, packet.data.name, loc.add(vector.fromDirection(Math.random() * Math.PI * 2).multiply(200)), rot);
                    }
                    catch(e) {
                        await con.sendError("Player already logged in", "Try changing your username.");
                        con.close();
                        return;
                    }
                    
                    let planet = new serverPlanet({ ...config.starter, location: loc });
                    this.planets.add(planet);
                    planet.population = planet.limit;
                    planet.owner = player;

                    socket.onClose.pipe(first()).subscribe(() => this.logout(player as serverPlayer));
                    con.onPacket<logoffPacketData>(packetCode.LOGOFF).subscribe(v => this.onLogoff(player)(v.data));
                    con.onPacket<controlPacketData>(packetCode.CONTROL).subscribe(v => this.onControl(player)(v.data));
                    con.onPacket<shipControlPacketData>(packetCode.SHIPCONTROL).subscribe(v => this.onShipControl(player)(v.data));
                    con.onPacket<clientChatPacketData>(packetCode.CHAT).subscribe(v => this.onChat(player)(v.data));
                }
            }
            catch (e: any) {
                console.log(e);
                con.sendError(e.message ?? 'Generic error.', e.description);
                con.connection.close();
                console.log("User failed to provide correct packets.");
            }
        });

        setInterval(() => {
            this.update();
            this.sync();
        }, this.delta * 1000);

    }
}
