import { Subscription } from "rxjs";
import { disposable } from "../disposable";
import { arrayProperty, valueProperty } from "./property";

// Indeed, I build an entire framework so I can clean up my code for
// a hackathon. Pretty savage of me

interface nameTrackerPair {
    name: string;
    tracker: changeTracker<any, propertyChangeDescriptor>;
}
interface nameApplierPair {
    name: string;
    applier: changeApplier<any, any>;
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

export function invertTranslator<srcT, destT>(translator: translator<srcT, destT>): translator<destT, srcT> {
    return {
        translateFrom: translator.translateTo,
        translateTo: translator.translateFrom,
    };
}

export interface changeTracker<T, descT> extends disposable {
    get changeDescriptor(): descT;
    get initDescriptor(): descT;
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
export class objectChangeApplier implements changeApplier<any, objectChangeDescriptor> {
    private props = new arrayProperty<nameApplierPair>();

    public applyChanges(descriptor: objectChangeDescriptor, obj: any): void {
        this.props.forEach(prop => {
            prop.applier.applyChanges(descriptor[prop.name], obj[prop.name]);
        });
    }

    public prop(name: string, isArray: boolean = false, translator: translator<any, any> = defaultTranslator) {
        if (this.props.value.find(v => v.name === name)) {
            throw new Error(`Property ${name} is already in the apply list.`);
        }

        if (isArray)
            this.props.add({
                name, isArray,
                applier: new arrayChangeApplier(translator),
            });
        else
            this.props.add({
                name, isArray,
                applier: new valueChangeApplier(translator)
            });

        return this;
    }

    constructor() {

    }
}

export class valueChangeTracker<propT, T = propT> implements changeTracker<T, valueChangeDescriptor<T>> {
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
    get initDescriptor(): valueChangeDescriptor<T> {
        return this.translator.translateTo(this.prop.value);
    }
    clearChanges(): void {
        this.changed = false;
    }

    constructor(private prop: valueProperty<propT>, private translator: translator<propT, T> = defaultTranslator) {
        this.changeHandle = prop.onChange.subscribe(() => this.changed = true);
    }
}
export class arrayChangeTracker<propT, T = propT> implements changeTracker<T[], arrayChangeDescriptor<T>> {
    private _added: arrayProperty<T>;
    private _removed: arrayProperty<T>;
    private _disposed = false;
    private _addHandle: Subscription;
    private _removeHandle: Subscription;

    public get added() {
        return this._added.value;
    }
    public get removed() {
        return this._removed.value;
    }

    public dispose(): void {
        if (this.disposed) return;
        this._addHandle.unsubscribe();
        this._removeHandle.unsubscribe();
    }
    public get disposed(): boolean {
        return this._disposed;
    }

    get initDescriptor(): arrayChangeDescriptor<T> {
        return {
            added: this.prop.value.map(v => this.translator.translateTo(v)),
            removed: [],
        };
    }
    get changeDescriptor(): arrayChangeDescriptor<T> {
        return {
            added: this._added.value,
            removed: this._removed.value,
        };
    }
    clearChanges(): void {
        this._added.clear();
        this._removed.clear();
    }

    constructor(private prop: arrayProperty<propT>, private translator: translator<propT, T> = defaultTranslator) {
        const equator = (a: T, b: T) =>  prop.equator(translator.translateFrom(a), translator.translateFrom(b));
        this._added = new arrayProperty(equator);
        this._removed = new arrayProperty(equator);

        this._addHandle = prop.onAdd.subscribe(v => {
            const translated = translator.translateTo(v);
            this._added.add(translated);
            this._removed.remove(translated);
        });
        this._removeHandle = prop.onRemove.subscribe(v => {
            const translated = translator.translateTo(v);
            this._removed.add(translated);
            this._added.remove(translated);
        });
    }
}
export class objectChangeTracker implements changeTracker<any, objectChangeDescriptor> {
    private trackers = new arrayProperty<nameTrackerPair>();
    private _disposed: boolean = false;

    public prop(name: string, isArray: boolean = false, translator: translator<any, any> = defaultTranslator) {
        if (this.trackers.value.find(v => v.name === name)) {
            throw new Error(`Property ${name} is already being tracked.`);
        }

        if (isArray)
            this.trackers.add({
                name,
                tracker: new arrayChangeTracker(this.object[name] as arrayProperty<any>, translator)
            });
        else
        this.trackers.add({
            name,
            tracker: new valueChangeTracker(this.object[name] as valueProperty<any>, translator)
        });

        return this;
    }
    public removeProp(...names: string[]) {
        this.trackers.removeIf(v => names.includes(v.name));
    }

    public get initDescriptor(): objectChangeDescriptor {
        let obj: objectChangeDescriptor = {};
        this.trackers.forEach(v => obj[v.name] = v.tracker.initDescriptor);
        return obj;
    }
    public get changeDescriptor(): objectChangeDescriptor {
        let obj: objectChangeDescriptor = {};
        this.trackers.forEach(v => obj[v.name] = v.tracker.changeDescriptor);
        return obj;
    }
    clearChanges(): void {
        this.trackers.forEach(v => v.tracker.clearChanges());
    }
    dispose(): void {
        if (this.disposed) return;
        this.trackers.forEach(v => v.tracker.dispose());
    }
    get disposed(): boolean {
        return this._disposed;
    }

    public constructor(private object: any) {

    }
}


export interface trackable<T, descT> {
    get tracker(): changeTracker<T, descT>;
}
export interface trackableObject extends trackable<any, objectChangeDescriptor> {
    get tracker(): objectChangeTracker;
}
