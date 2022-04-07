import { Observable, Subject } from "rxjs";
import { promisify } from "util";
import { assetData } from "../common/packets/server";
import { sound } from "./sound";

export interface imageAsset extends assetData {
    type: 'image';
    data: CanvasImageSource;
}
export interface soundAsset extends assetData {
    type: 'sound';
    data: sound;
}

export type asset = imageAsset | soundAsset;

const map = new Map<string, asset>();
export interface assetLoadEvent {
    asset: assetData;
    i: number;
}

export interface assetsType {
    tryGet(name: string, type: 'sound'): soundAsset | undefined;
    tryGet(name: string, type: 'image'): imageAsset | undefined;
    tryGet(name: string): asset | undefined;
    get(name: string, type: 'sound'): soundAsset;
    get(name: string, type: 'image'): imageAsset;
    get(name: string): asset;
    load(...assets: assetData[]): Observable<assetLoadEvent>;
}

async function loadSound(asset: assetData): Promise<void> {
    let s = await sound.fromURL(`assets/${asset.type}/${asset.name}.wav`);
    map.set(asset.name, { data: s, name: asset.name, type: 'sound' });
}
function loadImage(asset: assetData): Promise<void> {
    return new Promise((resolve, reject) => {
        let image = new Image();
        image.src = `assets/${asset.type}/${asset.name}.png`;
        image.onload = () => {
            image.onload = null;
            map.set(asset.name, { data: image, name: asset.name, type: 'image' });
            resolve();
        };
        image.onerror = e => {
            reject(new Error(`Could not load the image ${asset}.`));
        };
    });
}

async function loadOne(asset: assetData): Promise<void> {
    switch (asset.type) {
        case 'image': return await loadImage(asset);
        case 'sound': return await loadSound(asset);
        default: throw new Error(`Unknown asset type ${asset.type}.`);
    }
}

export const assets: assetsType = {
    tryGet(name: string, type?: 'sound' | 'image'): any {
        if (type) {
            let gotten = this.tryGet(name);
            if (gotten && gotten.type === type) return gotten;
            else return undefined;
        }
        else return map.get(name);
    },
    get(name: string, type?: 'sound' | 'image'): any {
        if (type) {
            let gotten = this.get(name);
            if (gotten.type === type) return gotten;
            else throw new Error(`The asset ${name} exists, but is not of type '${type}'.`);
        }
        else {
            let gotten = map.get(name);
            if (gotten) return gotten;
            else throw new Error(`The asset ${name} doesn't exist.`);
        }
    },
    load(...assets: assetData[]): Observable<assetLoadEvent> {
        let subject = new Subject<assetLoadEvent>();

        (async () => {
            let i = 0;
            for (let asset of assets) {
                try {
                    await loadOne(asset);
                    subject.next({ asset, i: i++ });
                }
                catch (e) {
                    if (e instanceof Error) e.message = `Couldn't load asset /static/${asset.type}/${asset.name}: ${e.message}`;
                    subject.error(e);
                }
            }
            subject.complete();
        })().then();

        return subject.asObservable();
    }
};