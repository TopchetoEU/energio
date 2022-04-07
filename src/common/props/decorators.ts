import { Observable } from "rxjs";
import { appliableObject, changeApplierFactory, changeTrackerFactory, propertyChangeDescriptor, trackableObject } from "./changes";
import { defaultEquator, equator, property, propertyFactory, valueProperty } from "./property";
import { translator } from "./translator";
import "reflect-metadata";
import { serverPlanet } from "../../server/serverPlanet";

export type abstractConstructor<T> = Function & { prototype: T };
export type constructor<T> = new (...args: any[]) => T;

export function extendConstructor<T>(constr: constructor<T>, ...extensions: Array<(this: T, ...args: any[]) => void>) {
    const extention = class extends (constr as constructor<any>) {
        constructor(...args: any[]) {
            super(...args);
            extensions.forEach(v => v.call(this as unknown as T, ...args));
        }
    }

    Object.defineProperty(extention, "name", {
        get: () => constr.name,
        configurable: false,
        enumerable: true,
    });
  
    return extention as any;
}

/**
 * Options, used for the prop() decorator
 */
export interface propOptions<T = any, valT = T, srcT = valT> {
    /**
     * The equator used by the property
     */
    equator?: equator<srcT>;
    /**
     * A custom observable, notifying when the object has been changed.
     * This won't override the default notifier
     */
    changeNotifier?: Observable<any>;
    /**
     * The translator, used to translate from the property type to a wanted type
     */
    translator?: translator<valT, srcT>;
    /**
     * A boolean value, specifying whether or not the property is read-only
     */
    isReadonly?: boolean;
    /**
     * A boolean value, specifying whether or not the property is being tracked for changes
     */
    isTracked?: boolean;
    // /**
    //  * A boolean value, specifying whether or not the property's value is a trackable object.
    //  * If this is set to true, recursive tracking will be enabled.
    //  */
    // isTrackable?: boolean;
}
export interface propFactories<T = any, descT = any, valT = T, srcT = valT>  {
    /**
     * A factory for trackers, that will be used to generate the change descriptor for the property
     */
    changeTrackerFactory: changeTrackerFactory<property<T>, descT, valT, srcT>;
    /**
     * A factory for appliers, that will be used to generate the applier for the property
     */
    changeApplierFactory: changeApplierFactory<any, descT, valT, srcT>;
    propFactory: propertyFactory<T, valT>;
}

interface propertyMetadata {
    factories: propFactories<any, any>;
    options: propOptions<any>;
}

function createPropMeta(target: any, name: string, factories: propFactories, options: propOptions) {
    getPropsMeta(target)[name] = { factories, options };
}
function getProp(target: any, name: string): property<any> {
    let meta = getPropMeta(target.constructor.prototype, name);
    if (meta === void 0) throw new Error(`Property meta for ${name} is not defined.`);

    if (!Reflect.hasMetadata('props:property', target, name)) {
        let res = meta.factories.propFactory(undefined,
            meta.options.equator ?? defaultEquator,
            meta.options.changeNotifier ?? new Observable()
        );

        Reflect.defineMetadata('props:property', res, target, name)
        return res;
    }
    else return Reflect.getMetadata('props:property', target, name);
}
function getPropMeta(target: any, name: string): propertyMetadata | undefined {
    return getPropsMeta(target)[name];
}
function getPropsMeta(target: any): { [name: string]: propertyMetadata } {
    let props = Reflect.getOwnMetadata('props:properties', target);
    if (props === void 0) {
        let inherited = Reflect.getMetadata('props:properties', target);
        if (inherited === void 0) inherited = {};
        Reflect.defineMetadata('props:properties', props = {...inherited}, target);
    }

    return props;
}

export function prop<T, descT, valT = T, srcT = valT>(factories: propFactories<T, descT, valT, srcT>, options: propOptions<any, propertyChangeDescriptor<any>>) {
    return (target: Object, key: string) => {
        createPropMeta(target, key, factories, options);

        if (Object.getOwnPropertyDescriptor(target, key))
            throw new Error(`A property accessor for ${key} in ${target} already exists.`);

        Object.defineProperty(target, key, {
            get(this: any) {
                return getProp(this, key).value;
            },
            set(this: any, val) {
                getProp(this, key).value = val;
            },
            configurable: false,
            enumerable: true,
        });
        Object.defineProperty(target, key + 'Changed', {
            get(this: any) {
                return getProp(this, key).onChange;
            },
            configurable: false,
            enumerable: true,
        });
    };
}

export function trackable<T extends trackableObject>(...constr: Array<(this: T, ...args: any[]) => void>) {
    return (target: constructor<T>): any => {
        return extendConstructor(target, function(...args: any[]) {
            let props = getPropsMeta(this);

            for (let name in props) {
                let propMeta = props[name];
                let prop = getProp(this, name);
                if (!propMeta.options.isTracked) continue;
                this.tracker.property(name, prop, propMeta.factories.changeTrackerFactory, propMeta.options.translator);
            }

            this.tracker.reset();

            constr.forEach(element => element.call(this, ...args));
        });
    };
}
export function appliable<T extends appliableObject>(...constr: Array<(this: T, ...args: any[]) => void>) {
    return (target: constructor<T>): any => {
        return extendConstructor(target, function(...args: any[]) {
            let props = getPropsMeta(this);

            for (let name in props) {
                let propMeta = props[name];
                let prop = getProp(this, name);
                if (!propMeta.options.isTracked) continue;
                this.applier.property(name, this, propMeta.factories.changeApplierFactory, propMeta.options.translator);
            }

            constr.forEach(element => element.call(this, ...args));
        });
    };
}

// Why do I have to do this?
function getArgs(func: Function) {
    return func.toString().split("(", 2)[1].split(")", 2)[0].split(",").map(v => v.trim());
}

export function paramProp(decorator: PropertyDecorator) {
    return (target: any, key: string, index: number) => {
        decorator(target.prototype, getArgs(target)[index]);
    }
}

export function getProperty<T>(target: any, name: string) {
    return Reflect.getMetadata('property', target, name) as property<T>;
}

export function constructorExtender<T>() {
    return (target: constructor<T>) => {
        return extendConstructor(target, function(...args: any[]) {
            let postconstr: ((...args: any) => any)[] | undefined = Reflect.getMetadata('postconstr', this);
            if (postconstr) postconstr.forEach(v => v.call(this, ...args));
        });
    };
}
export function afterConstructor() {
    return (target: any, key: string | symbol) => {
        let postconstr: any[];
        if ((postconstr = Reflect.getMetadata('postconstr', target)) === void 0) {
            Reflect.defineMetadata('postconstr', postconstr = [], target);
        }

        postconstr.push(target[key.toString()]);
    };
}

export const props = {
    getAll(target: Function) {
        return Object.keys(getPropsMeta(target.prototype)).map(v => getProp(target, v));
    },
    getNames(target: Function) {
        return Object.keys(getPropsMeta(target.prototype));
    },
    getAllMeta(target: Function) {
        return getPropsMeta(target.prototype);
    },
    get(target: Function, name: string) {
        return getProp(target, name);
    },
    getMeta(target: Function, name: string) {
        return getPropMeta(target.prototype, name);
    },
};