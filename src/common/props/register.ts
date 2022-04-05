import { map, merge, Observable, Subject, Subscription } from "rxjs";
import { changeApplier, changeApplierFactory, changeTracker, changeTrackerFactory } from "./changes";
import { prop, propOptions, propOptionsSource } from "./decorators";
import { defaultEquator, equator, property } from "./property";
import { defaultTranslator, translator, translators } from "./translator";

export class register<T> {
    private _arr: T[] = [];
    private _onAdd: Subject<T> = new Subject();
    private _onRemove: Subject<T> = new Subject();

    public get array() {
        return [ ...this._arr ];
    }
    public set array(val: T[]) {
        this.removeIf(v => !val.includes(v));
        this.add(...val.filter(v => !this._arr.includes(v)));
    }

    public get length() {
        return this._arr.length;
    }

    public add(...values: T[]) {
        values.forEach(val => {
            if (this.includes(val)) return;
            this._arr.push(val);
            this._onAdd.next(val);
        });
    }
    public remove(...values: T[]) {
        if (values.length === 0) return;
        this.removeIf(v => {
            return values.filter(element => this.equator(element, v)).length > 0;
        });
    }
    public removeIf(predicate: (el: T) => boolean) {
        let removed: T[] = [];

        this._arr = this._arr.filter(v => {
            if (predicate(v)) {
                removed.push(v);
                return false;
            }

            return true;
        });

        removed.forEach(v => this._onRemove.next(v));
    }
    public clear() {
        this.removeIf(() => true);
    }

    public forEach(iterator: (val: T) => void) {
        this._arr.forEach(iterator);
    }
    public map<T2>(mapper: (val: T) => T2) {
        return this.array.map(mapper);
    }
    public filter(predicate: (val: T) => boolean) {
        return this.array.filter(predicate);
    }
    public find(predicate: (val: T) => boolean): T | undefined {
        return this.array.filter(predicate)[0];
    }
    public reduce(reducer: (prev: T, curr: T) => T) : T;
    public reduce<T2>(reducer: (prev: T2, curr: T) => T2, initialValue: T2): T2;
    public reduce(reducer: (prev: any, curr: T) => any, initialValue?: any) {
        return this.array.reduce(reducer, initialValue);
    }

    public includesAll(...elements: T[]) {
        return this.array.filter(v => elements.filter(v2 => this.equator(v2, v)).length > 0).length === elements.length;
    }
    public includesAny(...elements: T[]) {
        return this.array.filter(v => elements.filter(v2 => this.equator(v2, v)).length > 0).length > 0;
    }
    public includes(element: T) {
        return this.array.filter(v => this.equator(element, v)).length > 0;
    }

    public get onAdd(): Observable<T> {
        return this._onAdd;
    }
    public get onRemove(): Observable<T> {
        return this._onRemove;
    }

    public get changeNotifier(): Observable<unknown> {
        return new Observable(sub => {
            this.onAdd.subscribe(sub);
            this.onRemove.subscribe(sub);
        });
    }

    public constructor(public readonly equator: equator<T> = defaultEquator, otherReg?: register<T>) {
        this.equator = equator;
        otherReg?.forEach(v => this.add(v));
    }
}

export class registerProperty<T> implements property<register<T>> {
    get value(): register<T> {
        return this.register;
    }
    set value(val: register<T>) {
        this.value.array = val.array;
    }

    get onChange(): Observable<register<T>> {
        return merge(this.register.onAdd, this.register.onRemove).pipe(
            map(v => this.value)
        );
    }

    public readonly equator: equator<register<T>> = (a, b) => a.includesAll(...b.array);

    public constructor(private register: register<T>, public readonly elementEquator: equator<T>) {
    }
}

export type registerChangeDescriptor<T> = {
    added?: T[];
    removed?: T[];
} | undefined;
export class registerChangeTracker<T, srcT = T> implements changeTracker<registerChangeDescriptor<srcT>> {
    private _added: register<srcT>;
    private _removed: register<srcT>;
    private _disposed = false;
    private _addHandle: Subscription;
    private _removeHandle: Subscription;

    private get register() {
        return this._register.value;
    }

    public static factory<T, srcT = T>(): changeTrackerFactory<property<register<T>>, registerChangeDescriptor<srcT>, T, srcT> {
        return (obj, translator) => new registerChangeTracker<T, srcT>(obj, translator);
    }

    public get added() {
        return this._added.array;
    }
    public get removed() {
        return this._removed.array;
    }

    public dispose(): void {
        if (this.disposed) return;
        this._addHandle.unsubscribe();
        this._removeHandle.unsubscribe();
    }
    public get disposed(): boolean {
        return this._disposed;
    }

    get initDescriptor(): registerChangeDescriptor<srcT> {
        let res = {
            added: this.register.array.map(v => this.translator.to(v)),
        };

        if (res.added.length === 0) return undefined;
        return res;
    }
    get changeDescriptor(): registerChangeDescriptor<srcT> {
        let res = {
            added: this._added.length === 0 ? undefined : this._added.array,
            removed: this._removed.length === 0 ? undefined : this._removed.array,
        };

        if (!res.added && !res.removed) return undefined;
        return res;
    }
    reset(): void {
        this._added.clear();
        this._removed.clear();
    }

    constructor(private _register: property<register<T>>, private translator: translator<T, srcT> = defaultTranslator) {
        const equator = (a: srcT, b: srcT) => this.register.equator(translator.from(a), translator.from(b));
        this._added = new register<srcT>(equator);
        this._removed = new register<srcT>(equator);

        this._addHandle = this.register.onAdd.subscribe(v => {
            const translated = translator.to(v);
            if (this._removed.includes(translated))
                this._removed.remove(translated);
            else
                this._added.add(translated);
        });
        this._removeHandle = this.register.onRemove.subscribe(v => {
            const translated = translator.to(v);
            if (this._added.includes(translated))
                this._added.remove(translated);
            else
                this._removed.add(translated);
        });
    }
}

export class registerChangeApplier<T, srcT = T> implements changeApplier<registerChangeDescriptor<srcT>> {
    public static factory<T, srcT = T>(name: string): changeApplierFactory<any, registerChangeDescriptor<srcT>, T, srcT> {
        return (obj, translator) => new registerChangeApplier<T, srcT>(obj, name, translator);
    }

    public apply(descriptor: registerChangeDescriptor<srcT>): void {
        let reg = this.obj[this.name] as register<T>;
        if (descriptor === void 0) return;
        if (descriptor.removed !== void 0) reg.remove(...descriptor.removed.map(v => this.translator.from(v)));
        if (descriptor.added !== void 0) reg.add(...descriptor.added.map(v => this.translator.from(v)));
    }

    constructor(private obj: any, private name: string, private translator: translator<T, srcT>) { }
}
export function registerPropFactory<T>(value: register<T>, equator: equator<T>) {
    return new registerProperty(value, equator);
}
export function registerProp<T, srcT = T>(options: propOptionsSource<register<T>, T, srcT> = { isReadonly: true }): PropertyDecorator {
    if (typeof options === 'object' && options.isReadonly === void 0) options.isReadonly = true;

    if (options instanceof Function)  {
        let oldOptions = options;
        options = v => {
            let res = oldOptions(v);
            if (res.isReadonly === void 0) res.isReadonly = true;

            return res;
        };
    }

    return (target, key) => prop<register<T>, registerChangeDescriptor<srcT>, T, srcT>({
        changeApplierFactory: registerChangeApplier.factory(key.toString()),
        changeTrackerFactory: registerChangeTracker.factory<T, srcT>(),
        propFactory: registerPropFactory,
    }, options)(target, key.toString());
}
