import { map, merge, Observable, Subject, Subscribable } from "rxjs";
import { AnyCatcher } from "rxjs/internal/AnyCatcher";
import { ExtMath } from "../vector";
import { appliable, changeApplier, changeApplierFactory, changeTracker, changeTrackerFactory, objectChangeApplier, propertyChangeApplier, propertyChangeDescriptor, propertyChangeTracker, trackable, trackableObject } from "./changes";
import { prop, propOptions } from "./decorators";
import { translator } from "./translator";

export type equator<T> = (a: T, b: T) => boolean;
export const defaultEquator: equator<any> = (a, b) => a === b;
export const numEquator: equator<number> = (a, b) => ExtMath.numEquals(a, b);

let propIdentifiers: string[] = [];
const idArr = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_=";

const getNextId = () => {
    let res = '';

    do {
        res = '';
        for (let i = 0; i < 50; i++) {
            res += idArr[Math.floor(Math.random() * idArr.length)];
        }
    }
    while (propIdentifiers.includes(res));

    propIdentifiers.push(res);

    return res;
}

export type propertyFactory<T, equT = T> = (value: T, equator: equator<equT>, changeNotifier: Observable<any>) => property<T>;

export interface property<T> {
    get value(): T;
    set value(val: T);

    get onChange(): Observable<T>;
    get equator(): equator<T>;
}

export class valueProperty<T> {
    private _value: T;
    private _onChange: Subject<T> = new Subject();

    public get value() {
        return this._value;
    }
    public set value(val: T) {
        if (this.equator(this.value, val)) return;
        this._value = val;
        this._onChange.next(val);
    }

    public get onChange(): Observable<T> {
        return this._onChange.asObservable();
    }

    public constructor(initialValue: T, public readonly equator: equator<T> = defaultEquator, public readonly changeNotifier: Observable<any> = new Observable()) {
        this._value = initialValue;
        this.equator = equator;
        changeNotifier.subscribe(v => this._onChange.next(this._value));
        (this as any)[getNextId()] = true; // Gives each property special property, so it can be identified as one
    }

    public static fromObject<T>(obj: any): property<T> {
        let names = Object.getOwnPropertyNames(obj)
            .filter(v => v.length === 50)
            .filter(v => propIdentifiers.includes(v));

        if (names.length >= 1) {
            return obj as property<T>;
        }
        else throw new Error("Given object is not a value property.");
    }
}

export function valueFactory<T>(defaultVal: T, equator: equator<T>, changeNotifier: Observable<any>): property<T> {
    return new valueProperty(defaultVal, equator, changeNotifier);
}

export function valProp(options?: propOptions<any, propertyChangeDescriptor<any>>, trackable?: boolean): PropertyDecorator {
    return (target: any, key) => {
        if (options === void 0) options = { } as propOptions<any, propertyChangeDescriptor<any>>;

        if (trackable) prop({
            changeApplierFactory: trackablePropertyChangeApplier.factory<any, any>(key.toString()),
            changeTrackerFactory: trackablePropertyChangeTracker.factory<any, any>(),
            propFactory: valueFactory,
        }, options)(target, key.toString());
        else prop({
            changeApplierFactory: propertyChangeApplier.factory<any>(key.toString()),
            changeTrackerFactory: propertyChangeTracker.factory<any>(),
            propFactory: valueFactory,
        }, options)(target, key.toString());
    }
}

export class trackablePropertyChangeApplier<descT, T extends appliable<descT>, srcT = T> implements changeApplier<propertyChangeDescriptor<srcT>> {
    public apply(descriptor: propertyChangeDescriptor<srcT>) {
        if (descriptor !== void 0) this.translator.from(descriptor).applier.apply(this.obj[this.name]);
    }
    public static factory<descT, T extends appliable<descT>, srcT = T>(name: string): changeApplierFactory<any, propertyChangeDescriptor<srcT>, T, srcT> {
        return (prop, translator) => new trackablePropertyChangeApplier(prop, name, translator);
    }

    public constructor(private obj: any, private name: string, private translator: translator<T, srcT>) { }
}
export class trackablePropertyChangeTracker<descT, srcT extends trackable<descT>, T = srcT> implements changeTracker<descT> {
    public static factory<descT, srcT extends trackable<descT>, T = srcT>(): changeTrackerFactory<property<T>, descT, T, srcT> {
        return (prop, translator) => new trackablePropertyChangeTracker<descT, srcT, T>(prop, translator);
    }

    get changeDescriptor(): descT | undefined {
        return this.translator.to(this.obj.value).tracker.changeDescriptor;
    }
    get initDescriptor(): descT | undefined {
        return this.translator.to(this.obj.value).tracker.initDescriptor;
    }
    reset(): void {
        this.translator.to(this.obj.value).tracker.reset();
    }

    constructor(private obj: property<T>, private translator: translator<T, srcT>) { }
}
