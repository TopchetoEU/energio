import { map, merge, Observable, Subject, Subscription } from "rxjs";
import { changeApplier, changeApplierFactory, changeTracker, changeTrackerFactory } from "./changes";
import { prop, propOptions } from "./decorators";
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

    public constructor(public equator: equator<T> = defaultEquator, otherReg?: register<T>) {
        this.equator = equator;
        otherReg?.forEach(v => this.add(v));
    }
}

export class registerProperty<T> implements property<register<T> | undefined> {
    get value(): register<T> | undefined {
        return this.register;
    }
    set value(val: register<T> | undefined) {
        if (val === this.value) return;
        this.register = val;
        this._onChange.next(val);
    }

    private _onChange = new Subject<register<T> | undefined>();

    get onChange(): Observable<register<T> | undefined> {
        if (this.register) return merge(
            this.register.onAdd.pipe(map(v => this.value)),
            this.register.onRemove.pipe(map(v => this.value)),
            this._onChange
        ).pipe(
            map(v => this.value)
        );
        else return new Observable();
    }

    public readonly equator: equator<register<T> | undefined> = (a, b) => {
        if (a === void 0 || b === void 0) return a === void 0 && b === void 0;
        return a.includesAll(...b.array) ?? true;
    }

    public constructor(private register: register<T> | undefined, public readonly elementEquator: equator<T>) {
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
    private _addHandle?: Subscription;
    private _removeHandle?: Subscription;
    private _equator?: equator<srcT>;
    private _oldRegister?: register<T>;

    private get register() {
        return this._register.value;
    }

    public static factory<T, srcT = T>(): changeTrackerFactory<property<register<T> | undefined>, registerChangeDescriptor<srcT>, T, srcT> {
        return (obj, translator) => {
            if (!(obj instanceof registerProperty))
                throw new Error("Register tracker may be used only on a register property.");
            return new registerChangeTracker<T, srcT>(obj, translator);
        }
    }

    public get added() {
        return this._added.array;
    }
    public get removed() {
        return this._removed.array;
    }

    public dispose(): void {
        if (this.disposed) return;
        this._addHandle?.unsubscribe();
        this._removeHandle?.unsubscribe();
    }
    public get disposed(): boolean {
        return this._disposed;
    }

    get initDescriptor(): registerChangeDescriptor<srcT> {
        let res = {
            added: this.register?.array.map(v => this.translator.to(v)),
        };

        if (!res.added || res.added.length === 0) return undefined;
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

    private add(el: T) {
        const translated = this.translator.to(el);
        if (this._removed.includes(translated))
            this._removed.remove(translated);
        else
            this._added.add(translated);
    }
    private remove(el: T) {
        const translated = this.translator.to(el);
        if (this._added.includes(translated))
            this._added.remove(translated);
        else
            this._removed.add(translated);
    }

    private changeReg() {
        if (this._oldRegister === this.register) return;
        this._addHandle?.unsubscribe();
        this._removeHandle?.unsubscribe();

        if (this.register) this._equator = (a: srcT, b: srcT) => this._register!.elementEquator(this.translator.from(a), this.translator.from(b));
        else this._equator = undefined;

        this._oldRegister?.forEach(this.remove.bind(this));
        this._added.equator = this._equator ?? defaultEquator;
        this._removed.equator = this._equator ?? defaultEquator;
        this.register?.forEach(this.add.bind(this));

        if (this.register) {
            this._addHandle = this.register?.onAdd.subscribe(v => this.add(v));
            this._removeHandle = this.register?.onRemove.subscribe(v => this.remove(v));
        }

        this._oldRegister = this._register.value;
    }

    constructor(private _register: registerProperty<T>, private translator: translator<T, srcT> = defaultTranslator) {
        this._added = new register<srcT>();
        this._removed = new register<srcT>();

        this.changeReg();
        _register.onChange.subscribe(v => this.changeReg());
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
export function registerPropFactory<T>(value: register<T> | undefined, equator: equator<T>) {
    return new registerProperty(value, equator);
}
export function registerProp<T, srcT = T>(options: propOptions<register<T> | undefined, T, srcT> = { isReadonly: true }): PropertyDecorator {
    if (options.isReadonly === void 0) options.isReadonly = true;

    return (target, key) => prop<register<T> | undefined, registerChangeDescriptor<srcT>, T, srcT>({
        changeApplierFactory: registerChangeApplier.factory(key.toString()),
        changeTrackerFactory: registerChangeTracker.factory<T, srcT>(),
        propFactory: registerPropFactory,
    }, options)(target, key.toString());
}
