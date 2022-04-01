import { map, merge, Observable, Subject, Subscribable } from "rxjs";
import { ExtMath } from "../vector";

export type equator<T> = (a: T, b: T) => boolean;
export const defaultEquator: equator<any> = (a, b) => a === b;
export const numEquator: equator<number> = (a, b) => ExtMath.numEquals(a, b);

let propIdentifiers: string[] = [];
let arrIdentifiers: string[] = [];
const idArr = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_=";

const getNextArrId = () => {
    let res = '';

    do {
        res = '';
        for (let i = 0; i < 50; i++) {
            res += idArr[Math.floor(Math.random() * idArr.length)];
        }
    }
    while (arrIdentifiers.includes(res));

    arrIdentifiers.push(res);

    return res;
}
const getNextPropId = () => {
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
        this._value = val;
        this._onChange.next(val);
    }

    public get onChange(): Observable<T> {
        return this._onChange;
    }

    public constructor(initialValue: T, public readonly equator: equator<T> = defaultEquator) {
        this._value = initialValue;
        this.equator = equator;
        (this as any)[getNextPropId()] = true; // Gives each property special property, so it can be identified as one
    }

    public static fromObject<T>(obj: any): valueProperty<T> {
        let names = Object.getOwnPropertyNames(obj)
            .filter(v => v.length === 50)
            .filter(v => propIdentifiers.includes(v));

        if (names.length >= 1) {
            return obj as valueProperty<T>;
        }
        else throw new Error("Given object is not a value property.");
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

    public forEach(iterator: (val: T) => void) {
        this.value.forEach(iterator);
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
        (this as any)[getNextArrId()] = true; // Gives each property special property, so it can be identified as one
    }

    public static fromObject<T>(obj: any): arrayProperty<T> {
        let names = Object.getOwnPropertyNames(obj)
            .filter(v => v.length === 50)
            .filter(v => arrIdentifiers.includes(v));

        if (names.length >= 1) {
            return obj as arrayProperty<T>;
        }
        else throw new Error("Given object is not an array property.");
    }
}