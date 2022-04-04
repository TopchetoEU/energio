import { NIL } from "uuid";
import { abstractConstructor, paramProp } from "./props/decorators";
import { valProp } from "./props/property";

let objects: gameObject[] = [];

export class gameObject {
    public constructor(
        @paramProp(valProp({ isTracked: true })) public readonly id: string
    ) {
        if (gameObjectManager.includes(id)) {
            throw new Error("Object with same ID already exists.");
        }
        objects.push(this);
    }
}

export const gameObjectManager = Object.freeze({
    includes(id: string | gameObject): boolean {
        if (typeof id !== 'string') return objects.includes(id);

        if (id === NIL) return false;
        return objects.filter(v => v.id === id).length > 0;
    },
    get(id: string | gameObject): gameObject {
        return this.getTyped(id, gameObject);
    },
    getTyped<T extends gameObject>(id: string | gameObject, type?: abstractConstructor<T>): T {
        if (typeof id !== 'string') return this.getTyped(id.id, type);

        let objs = objects.filter(v => v.id === id);

        if (id === NIL) throw new Error("A NIL id was given.");
        if (objs.length === 0) throw new Error(`A game object with the id ${id} doesn't exist.`);
    
        let obj = objs[0];
        if (type !== void 0 && !(obj instanceof type))
            throw new Error(`The game object with id ${id} exists, but is not a ${type.name}.`);

        return obj as T;
    },
    getMaybe(id: string | gameObject): gameObject | undefined {
        try {
            return this.get(id);
        }
        catch {
            return void 0;
        }
    },
    getTypedMaybe<T extends gameObject>(id: string | gameObject, type?: abstractConstructor<T>): T | undefined {
        try {
            return this.getTyped(id, type);
        }
        catch {
            return void 0;
        }
    },
    getAll<T extends gameObject = gameObject>(type?: abstractConstructor<T>) {
        if (type === void 0) return [ ...objects] as T[];
        else return objects.filter(v => v instanceof type) as T[];
    }
});