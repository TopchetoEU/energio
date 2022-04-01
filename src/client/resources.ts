import { promisify } from "util";

const map: { [src: string]: HTMLImageElement } = {};

export const resources = {
    getImage(src: string): Promise<CanvasImageSource> {
        src = 'images/' + src;
        return new Promise((resolve, reject) => {
            let img = map[src];
            if (img) return resolve(img);
            else {
                img = new Image();
                img.src = src;
                img.onload = () => {
                    img.onload = null;
                    map[src] = img;
                    resolve(img);
                };
                img.onerror = err => {
                    if (typeof err === 'string') reject(new Error(err));
                    else reject(new Error(`Failed to load resource ${src}. Is the URL correct?`));
                };
            }
        });
    }
};