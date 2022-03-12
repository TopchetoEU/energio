import { map, merge, Observable, Subject, Subscribable } from "rxjs";
import { ExtMath } from "../vector";

export type equator<T> = (a: T, b: T) => boolean;
export const defaultEquator: equator<any> = (a, b) => a === b;
export const numEquator: equator<number> = (a, b) => ExtMath.numEquals(a, b);

export interface property<T> {
    get value(): T;
    set value(val: T);

    get onChange(): Observable<T>;
}

export class valueProperty<T> implements property<T> {
    private _value: T;
    private _onChange: Subject<T> = new Subject();

    public get value() {
        return this._value;
    }
    public set value(val: T) {
        if (this.equator(this.value, val)) return;
        this._onChange.next(val);
        this._value = val;
    }

    public get onChange(): Observable<T> {
        return this._onChange;
    }

    public constructor(initialValue: T, public readonly equator: equator<T> = defaultEquator) {
        this._value = initialValue;
        this.equator = equator;
    }
}

export class arrayProperty<T> implements property<T[]> {
    private _arr: T[] = [];
    private _onAdd: Subject<T> = new Subject();
    private _onRemove: Subject<T> = new Subject();

    public get value() {
        return [ ...this._arr ];
    }
    public set value(val: T[]) {
        this.clear();
        this.add(...val);
    }

    public add(...values: T[]) {
        values.forEach(val => {
            this._arr.push(val);
            this._onAdd.next(val);
        });
    }
    public remove(...values: T[]) {
        this.removeIf(v => {
            values.forEach(element => {
                if (this.equator(element, v)) return true;
            });

            return false;
        });
    }
    public removeIf(predicate: (el: T) => boolean) {
        this._arr = this._arr.filter(v => {
            if (predicate(v)) {
                this._onRemove.next(v);
                return false;
            }

            return true;
        });
    }
    public clear() {
        this._arr.forEach(val => {
            this._onRemove.next(val);
        });
        this._arr = [];
    }

    public get onAdd(): Observable<T> {
        return this._onAdd;
    }
    public get onRemove(): Observable<T> {
        return this._onRemove;
    }
    public get onChange(): Observable<T[]> {
        return merge(this.onAdd, this.onRemove).pipe(
            map(v => this.value)
        );
    }

    public constructor(public readonly equator: equator<T> = defaultEquator) {
        this.equator = equator;
    }
}