import { NIL } from "uuid";
import { abstractConstructor, paramProp } from "./props/decorators";
import { valProp } from "./props/property";
import { register } from "./props/register";

let objects = new Map<string, gameObjectBase>();

export type freeFunc<T> = (val: T) => void;

export interface gameObject {
    readonly id: string;
    remove(): void;
}

export class gameObjectBase implements gameObject {
    public constructor(
        @paramProp(valProp({ isTracked: true })) public readonly id: string,
        private readonly free?: freeFunc<gameObject>
    ) {
        if (gameObjectManager.includes(id)) {
            throw new Error("Object with same ID already exists.");
        }
        objects.set(id, this);
    }

    public remove() {
        if (this.free) this.free(this);
        objects.delete(this.id);
    }

    public toString() {
        return `${this.constructor.name}: ${this.id}`;
    }
}

export const gameObjectManager = Object.freeze({
    includes(id: string | gameObjectBase): boolean {
        if (typeof id !== 'string') return objects.has(id.id);

        if (id === NIL) return false;
        return objects.has(id);
    },
    get(id: string | gameObjectBase): gameObjectBase {
        return this.getTyped(id, gameObjectBase);
    },
    getTyped<T extends gameObjectBase>(id: string | gameObjectBase, type?: abstractConstructor<T>): T {
        if (typeof id !== 'string') return this.getTyped(id.id, type);

        let obj = objects.get(id);

        if (id === NIL) throw new Error("A NIL id was given.");
        if (!obj) throw new Error(`A game object with the id ${id} doesn't exist.`);
    
        if (type !== void 0 && !(obj instanceof type))
            throw new Error(`The game object with id ${id} exists, but is not a ${type.name}.`);

        return obj as T;
    },
    getMaybe(id: string | gameObjectBase): gameObjectBase | undefined {
        try {
            return this.get(id);
        }
        catch {
            return void 0;
        }
    },
    getTypedMaybe<T extends gameObjectBase>(id: string | gameObjectBase, type?: abstractConstructor<T>): T | undefined {
        try {
            return this.getTyped(id, type);
        }
        catch {
            return void 0;
        }
    },
    getAll<T extends gameObjectBase = gameObjectBase>(type?: abstractConstructor<T>): T[] {
        if (type === void 0) return Array.from(objects.values()) as T[];
        else return this.getAll().filter(v => v instanceof type) as T[];
    }
});