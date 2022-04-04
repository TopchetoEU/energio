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

export type propOptionsProvider<T, valT = T, srcT = valT> = (obj: any) => propOptions<T, valT, srcT>;
export type propOptionsSource<T, valT = T, srcT = valT> = propOptionsProvider<T, valT, srcT> | propOptions<T, valT, srcT>;

/**
 * Options, used for the prop() decorator
 */
export interface propOptions<T, valT = T, srcT = valT> {
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
export interface propFactories<T, descT, valT = T, srcT = valT>  {
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
    factories?: propFactories<any, any>;
    options?: propOptions<any>;
    optionsProvider?: propOptionsProvider<any>;
}

function getProp(target: any, name: string): propertyMetadata {
    let props = getProps(target);
    if (props[name] === void 0) props[name] = {  };

    return props[name];
}
function getProps(target: any): { [name: string]: propertyMetadata } {
    let props = Reflect.getMetadata('properties', target);
    if (props === void 0) Reflect.defineMetadata('properties', props = {}, target);

    return props;
}

export function prop<T, descT, valT = T, srcT = valT>(factories: propFactories<T, descT, valT, srcT>, options: propOptionsSource<any, propertyChangeDescriptor<any>>) {
    let optionsProvider!: propOptionsProvider<any, propertyChangeDescriptor<any>>;

    switch (typeof options) {
        case 'undefined':
            optionsProvider = () => ({ });
            break;
        case 'function':
            optionsProvider = options;
            break;
        default:
            optionsProvider = () => options;
    }

    return (target: any, key: string) => {
        getProps(target)[key] = { factories, optionsProvider };
        let keys = [];
        for (let prop in getProps(target)) {
            keys.push(prop);
        }
    };
}

export function propOwner() {
    return (target: constructor<any>): any => {
        return extendConstructor(target, function() {
            let props = getProps(target.prototype);

            for (let name in props) {
                let propDescription = props[name];

                if (propDescription.factories === void 0 || propDescription.optionsProvider === void 0)
                    throw new Error(`Property ${name} is not fully defined. Maybe you forgot a @param() decorator.`);

                propDescription.options = propDescription.optionsProvider(this);

                let prop = propDescription.factories.propFactory(
                    (this as any)[name],
                    propDescription.options.equator ?? defaultEquator,
                    propDescription.options.changeNotifier ?? new Observable()
                );

                Reflect.defineMetadata('property', prop, this, name);

                if (propDescription.options.isReadonly) {
                    Object.defineProperty(this, name, {
                        get: () => prop.value,
                        set: () => { throw new Error("You're trying to set a readonly property.") },
                        configurable: false,
                        enumerable: true,
                    });
                }
                else {
                    Object.defineProperty(this, name, {
                        get: () => prop.value,
                        set: val => prop.value = val,
                        configurable: false,
                        enumerable: true,
                    });
                }

                Object.defineProperty(this, name + 'Changed', {
                    get: () => prop.onChange,
                    configurable: false,
                    enumerable: true,
                });
            }
        });
    };
}
export function trackable() {
    return (target: constructor<trackableObject>, key?: string): any => {
        return extendConstructor(target, function() {
            let props = getProps(this)

            for (let name in props) {
                let propDesc = props[name];
                if (!propDesc.options?.isTracked) continue;

                if (propDesc.factories === void 0 || propDesc.options === void 0)
                    throw new Error("A @property() decorator must be used on @tracked() properties.");

                let prop = Reflect.getMetadata('property', this, name) as property<any> | undefined;
                if (prop === void 0) 
                    throw new Error(`Property ${name} hasn't been defined yet. Note that @trackable() should be ran after @propOwner().`);

                this.tracker.property(name, prop, propDesc.factories.changeTrackerFactory, propDesc.options.translator);
            }
        });
    };
}
export function appliable() {
    return (target: constructor<appliableObject>): any => {
        return extendConstructor(target, function() {
            let props = getProps(this)

            for (let name in props) {
                let propDesc = props[name];

                if (propDesc.factories === void 0 || propDesc.options === void 0)
                    throw new Error("A @property() decorator must be used on @tracked() properties.");

                if (!propDesc.options.isTracked) continue;

                let prop = Reflect.getMetadata('property', this, name) as property<any> | undefined;
                if (prop === void 0) 
                    throw new Error(`Property ${name} hasn't been defined yet. Note that @appliable() should be ran after @propOwner().`);

                this.applier.prop(name, this, propDesc.factories.changeApplierFactory, propDesc.options.translator);
            }
        });
    };
}

// Why do I have to do this?
function getArgs(func: Function) {
    return func.toString().split("(", 2)[1].split(")", 2)[0].split(",").map(v => v.trim());
}

export function paramProp(decorator: PropertyDecorator) {
    return (target: any, key: string, index: number) => {
        decorator(target.constructor, getArgs(target)[index]);
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