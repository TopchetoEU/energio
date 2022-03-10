import { player } from "./player";


export abstract class game {
    private playerList: player[] = [];

    public get players() {
        return [...this.playerList];
    }
    public getPlayer(name: string): player | undefined {
        return this.playerList.find(v => v.name == name);
    }

    public abstract get delta(): number;
}
