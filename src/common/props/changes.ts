import { Subscription } from "rxjs";
import { props } from "./decorators";
import { property, valueProperty } from "./property";
import { register } from "./register";
import { defaultTranslator, translator, translators } from "./translator";

// Indeed, I build an entire framework so I can clean up my code for
// a hackathon. Pretty savage of me

export function clone(obj: any) {
    if (typeof obj === 'object') {
        if (Object.isFrozen(obj)) return obj;
        else if (obj instanceof Array) {
            return [ ...obj ];
        }
        else if (obj.constructor) {
            const possibleFuncNames = [ 'clone', 'Clone', 'copy', 'Copy', 'copyOf', 'CopyOf' ];

            for (let name of possibleFuncNames) {
                if (typeof obj[name] === 'function') return obj[name]();
            }
            return obj;
        }
        else return { ...obj };
    }
    else return obj;
}

export type propertyChangeDescriptor<T> = T | undefined;
export type objectChangeDescriptor = {
    [name: string]: propertyChangeDescriptor<any>;
} | undefined;

export type changeTrackerFactory<T, descT, valT, srcT = valT> = (obj: T, translator: translator<valT, srcT>) => changeTracker<descT>;
export interface changeTracker<descT> {
    get changeDescriptor(): descT | undefined;
    get initDescriptor(): descT | undefined;
    reset(): void;
}

export type changeApplierFactory<T, descT, valT, srcT = valT> = (obj: T, translator: translator<valT, srcT>) => changeApplier<descT>;
export interface changeApplier<descT> {
    apply(descriptor: descT): void;
}

export class propertyChangeApplier<srcT, T> implements changeApplier<propertyChangeDescriptor<srcT>> {
    public apply(descriptor: propertyChangeDescriptor<srcT>) {
        if (descriptor !== void 0) this.obj[this.name] = this.translator.from(descriptor);
    }
    public static factory<T, srcT = T>(name: string): changeApplierFactory<any, propertyChangeDescriptor<srcT>, T, srcT> {
        return (prop, translator) => new propertyChangeApplier(prop, name, translator);
    }

    public constructor(private obj: any, private name: string, private translator: translator<T, srcT>) { }
}
export function isEmpty(object: any) {
    for (const property in object) {
        if (object[property] !== void 0) return false;
    }
    return true;
}
export class objectChangeApplier implements changeApplier<objectChangeDescriptor> {
    private props: Map<string, changeApplier<propertyChangeDescriptor<any>>> = new Map();

    private get object() {
        return this.translator.from(this.obj);
    }
    public static factory(): changeApplierFactory<any, objectChangeDescriptor, any> {
        return obj => new objectChangeApplier(obj);
    }
    public apply(desc: objectChangeDescriptor) {
        if (desc === void 0) return;
        for (let [ prop, applier ] of this.props) {
            applier.apply(desc[prop]);
        }
    }

    public property(name: string, target: any, changeApplierFactory?: changeApplierFactory<any, propertyChangeDescriptor<any>, any, any>, translator: translator<any, any> = defaultTranslator) {
        if (this.props.has(name)) {
            throw new Error(`Property '${name}' is already in the apply list.`);
        }

        if (!changeApplierFactory) changeApplierFactory = propertyChangeApplier.factory(name);

        this.props.set(name, changeApplierFactory(target, translator));
        return this;
    }

    constructor(private obj: any, private translator: translator<any, any> = defaultTranslator) { }
}

export class propertyChangeTracker<T, srcT = T> implements changeTracker<propertyChangeDescriptor<srcT>> {
    private changed = false;

    public static factory<T, srcT = T>(): changeTrackerFactory<property<T>, propertyChangeDescriptor<srcT>, T, srcT> {
        return (prop, translator) => new propertyChangeTracker<T, srcT>(prop, translator);
    }

    get changeDescriptor(): propertyChangeDescriptor<srcT> {
        return this.changed ? this.translator.to(this.prop.value) : undefined;
    }
    get initDescriptor(): propertyChangeDescriptor<srcT> {
        return this.translator.to(this.prop.value);
    }
    reset(): void {
        this.changed = false;
    }

    constructor(private prop: property<T>, private translator: translator<T, srcT> = defaultTranslator) {
        this.prop.onChange.subscribe(() => this.changed = true);
    }
}
export class objectChangeTracker implements changeTracker<objectChangeDescriptor> {
    private trackers: { [ name: string]: changeTracker<propertyChangeDescriptor<any>> } = { }

    private get object() {
        return this.translator.to(this.obj);
    }

    public static factory(): changeTrackerFactory<any, objectChangeDescriptor, any> {
        return (obj, translator) => new objectChangeTracker(obj, translator);
    }

    public prop(name: string, translator: translator<any, any> = defaultTranslator, trackerFactory: changeTrackerFactory<any, any, any>) {
        this.property(name, valueProperty.fromObject<any>(this.object[name]), trackerFactory, translator);
    }
    public property(name: string, prop: property<any>, trackerFactory: changeTrackerFactory<any, any, any>, translator: translator<any, any> = defaultTranslator) {
        if (this.trackers[name]) {
            throw new Error(`Property ${name} is already being tracked.`);
        }

        this.trackers[name] = trackerFactory(prop, translator);

        return this;
    }

    public get initDescriptor(): objectChangeDescriptor {
        let obj: objectChangeDescriptor = {};
        for (let name in this.trackers) {
            obj[name] = this.trackers[name].initDescriptor;
        }

        if (isEmpty(obj)) return undefined;
        return obj;
    }
    public get changeDescriptor(): objectChangeDescriptor {
        let obj: objectChangeDescriptor = {};
        for (let name in this.trackers) {
            obj[name] = this.trackers[name].changeDescriptor;
        }

        if (isEmpty(obj)) return undefined;
        return obj;
    }

    public reset(): void {
        for (let name in this.trackers) {
            this.trackers[name].reset();
        }
    }

    public constructor(private obj: any, private translator: translator<any, any> = defaultTranslator) { }
}

export interface trackable<descT> {
    get tracker(): changeTracker<descT>;
}
export interface trackableObject extends trackable<objectChangeDescriptor> {
    get tracker(): objectChangeTracker;
}

export interface appliable<descT> {
    get applier(): changeApplier<descT>;
}
export interface appliableObject extends appliable<objectChangeDescriptor> {
    get applier(): objectChangeApplier;
}

export function initAndReset(appliable: appliableObject, trackable: trackableObject) {
    appliable.applier.apply(trackable.tracker.initDescriptor);
}
export function applyChangesAndReset(appliable: appliableObject, trackable: trackableObject) {
    appliable.applier.apply(trackable.tracker.changeDescriptor);
    trackable.tracker.reset();
}