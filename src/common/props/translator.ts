import { gameObject } from "../gameObject";
import { objectChangeTracker, trackableObject } from "./changes";

/**
 * An object that translates values from srcT to destT and in reverse
 */
export interface translator<srcT, destT> {
    /**
     * Translates val to destT
     * @param val The value to translate
     */
    to(val: srcT): destT;
    /**
     * Translates val to srcT
     * @param val The value to translate
     */
    from(val: destT): srcT;
}

export const defaultTranslator: translator<any, any> = {
    from: v => v,
    to: v => v,
};

export function invertTranslator<srcT, destT>(translator: translator<srcT, destT>): translator<destT, srcT> {
    return {
        from: translator.to,
        to: translator.from,
    };
}
export function chainTranslators<srcT, midT, destT>(first: translator<srcT, midT>, second: translator<midT, destT>): translator<srcT, destT> {
    return {
        from: v => first.from(second.from(v)),
        to: v => second.to(first.to(v)),
    };
}
export function translators<InT, OutT = InT>() {
    return {
        from: (funcFrom?: (a: OutT) => InT) => ({
            to: (funcTo?: (a: InT) => OutT) => ({
                from: funcFrom ?? (v => v),
                to: funcTo ?? (v => v),
            }) as translator<InT, OutT>,
        }),
        to: (funcTo?: (a: InT) => OutT) => ({
            from: (funcFrom?: (a: OutT) => InT) => ({
                from: funcFrom ?? (v => v),
                to: funcTo ?? (v => v),
            }) as translator<InT, OutT>,
        })
    }
}
