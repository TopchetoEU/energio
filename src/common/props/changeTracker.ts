import { Subscription } from "rxjs";
import { disposable } from "../decommissionable";
import { arrayProperty, valueProperty } from "./property";

// Indeed, I build an entire framework so I can clean up my code for
// a hackathon. Pretty savage of me

interface nameTrackerPair {
    name: string;
    tracker: changeTracker<unknown, propertyChangeDescriptor>;
    isArray: boolean;
}

/**
 * An object, describing changes in an array
 */
export interface arrayChangeDescriptor<T> {
    added: T[];
    removed: T[];
}
export type valueChangeDescriptor<T> = T | undefined;
export type propertyChangeDescriptor = valueChangeDescriptor<any> | arrayChangeDescriptor<any>;
/**
 * An object describing changes in another object
 */
export interface objectChangeDescriptor {
    [name: string]: propertyChangeDescriptor;
}

/**
 * An object that translates values from srcT to destT and in reverse
 */
export interface translator<srcT, destT> {
    /**
     * Translates val to destT
     * @param val The value to translate
     */
    translateTo(val: srcT): destT;
    /**
     * Translates val to srcT
     * @param val The value to translate
     */
    translateFrom(val: destT): srcT;
}

export const defaultTranslator: translator<any, any> = {
    translateFrom: v => v,
    translateTo: v => v,
};

export interface changeTracker<T, descT> extends disposable {
    get changeDescriptor(): descT;
    clearChanges(): void;
}

export interface changeApplier<T, descT> {
    applyChanges(descriptor: descT, obj: T): void;
}

export class valueChangeApplier<srcT, T> implements changeApplier<valueProperty<srcT>, valueChangeDescriptor<T>> {
    public applyChanges(descriptor: valueChangeDescriptor<T>, obj: valueProperty<srcT>) {
        if (descriptor !== void 0) obj.value = this.translator.translateFrom(descriptor);
    }

    public constructor(private translator: translator<srcT, T> = defaultTranslator) {
    }
}
export class arrayChangeApplier<srcT, T> implements changeApplier<arrayProperty<srcT>, arrayChangeDescriptor<T>> {
    public applyChanges(descriptor: arrayChangeDescriptor<T>, obj: arrayProperty<srcT>) {
        obj.remove(...descriptor.removed.map(v => this.translator.translateFrom(v)));
        obj.add(...descriptor.added.map(v => this.translator.translateFrom(v)));
    }

    public constructor(private translator: translator<srcT, T> = defaultTranslator) {
    }
}

export class valueChangeTracker<PropT, T> implements changeTracker<T, valueChangeDescriptor<T>> {
    private _dispose = false;
    private changeHandle: Subscription;
    private changed = false;

    public dispose(): void {
        if (this.disposed) return;
        this.changeHandle.unsubscribe();
    }
    public get disposed(): boolean {
        return this._dispose;
    }

    get changeDescriptor(): valueChangeDescriptor<T> {
        return this.changed ? this.translator.translateTo(this.prop.value) : undefined;
    }
    clearChanges(): void {
        this.changed = false;
    }

    constructor(private prop: valueProperty<PropT>, private translator: translator<PropT, T> = defaultTranslator) {
        this.changeHandle = prop.onChange.subscribe(() => this.changed = true);
    }
}
export class arrayChangeTracker<propT, T> implements changeTracker<T[], arrayChangeDescriptor<T>> {
    private added: arrayProperty<T>;
    private removed: arrayProperty<T>;
    private _dispose = false;
    private addHandle: Subscription;
    private removeHandle: Subscription;

    public dispose(): void {
        if (this.disposed) return;
        this.addHandle.unsubscribe();
        this.removeHandle.unsubscribe();
    }
    public get disposed(): boolean {
        return this._dispose;
    }

    get changeDescriptor(): arrayChangeDescriptor<T> {
        return {
            added: this.added.value,
            removed: this.removed.value,
        };
    }
    clearChanges(): void {
        this.added.clear();
        this.removed.clear();
    }

    constructor(prop: arrayProperty<propT>, translator: translator<propT, T> = defaultTranslator) {
        const equator = (a: T, b: T) =>  prop.equator(translator.translateFrom(a), translator.translateFrom(b));
        this.added = new arrayProperty(equator);
        this.removed = new arrayProperty(equator);

        this.addHandle = prop.onAdd.subscribe(v => {
            const translated = translator.translateTo(v);
            this.added.add(translated);
            this.removed.remove(translated);
        });
        this.removeHandle = prop.onRemove.subscribe(v => {
            const translated = translator.translateTo(v);
            this.removed.add(translated);
            this.added.remove(translated);
        });
    }
}

export interface trackable<T, descT> {
    get tracker(): changeTracker<T, descT>;
}
export interface trackableObject extends trackable<any, objectChangeDescriptor> {
    get tracker(): objectChangeTracker;
}

export class objectChangeTracker implements changeTracker<any, objectChangeDescriptor> {
    private trackers = new arrayProperty<nameTrackerPair>();
    private _disposed: boolean = false;

    public track(name: string, isArray: boolean = false, translator: translator<any, any> = defaultTranslator) {
        if (this.trackers.value.find(v => v.name === name)) {
            throw new Error(`Property ${name} is already being tracked.`);
        }

        if (isArray)
            this.trackers.add({
                name, isArray,
                tracker: new arrayChangeTracker(this.object[name] as arrayProperty<any>, translator)
            });
        else
        this.trackers.add({
            name, isArray,
            tracker: new valueChangeTracker(this.object[name] as valueProperty<any>, translator)
        });

        return this;
    }
    public untrack(...names: string[]) {
        this.trackers.removeIf(v => names.includes(v.name));
    }

    public get changeDescriptor(): objectChangeDescriptor {
        let obj: objectChangeDescriptor = {};
        this.trackers.value.forEach(v => obj[v.name] = v.tracker.changeDescriptor);
        return obj;
    }
    clearChanges(): void {
        this.trackers.value.forEach(v => v.tracker.clearChanges());
    }
    dispose(): void {
        if (this.disposed) return;
        this.trackers.value.forEach(v => v.tracker.dispose());
    }
    get disposed(): boolean {
        return this._disposed;
    }

    public constructor(private object: any) {

    }
}
