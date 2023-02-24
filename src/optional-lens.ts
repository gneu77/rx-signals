/* eslint-disable @typescript-eslint/naming-convention */

/**
 * Returns number in case `T` is an `Array`,
 * else if `T extends Record<any, any>`, it returns the keys of it,
 * else it returns never.
 */
export type ToKeys<T> = T extends Array<any>
  ? number
  : T extends Record<any, any>
  ? {
      [K in keyof T]: K;
    }[keyof T]
  : never;

/**
 * Return type of the pick function.
 */
export type PickReturn<T, K extends ToKeys<T>> = T extends Array<infer A>
  ? A | undefined
  : T extends Record<any, any>
  ? K extends keyof T
    ? T[K] | undefined
    : never
  : undefined;

/**
 * Takes a value `T` and a key `K`.
 * If value is an `Array<A>` (`K` is enforced as number in this case), it returns `value[key]` as `A | undefined`.
 * If value is a `Record<any, any>` (`K` is enforced as `keyof T` in this case), it returns `value[key]` as `T[K] | undefined`.
 * Else it returns undefined.
 */
export const pick = <T, K extends ToKeys<T>>(value: T | undefined, key: K): PickReturn<T, K> => {
  if (Array.isArray(value)) {
    return value[key];
  }
  if (value !== null && typeof value === 'object') {
    return (<Record<K, any>>value)[key] as PickReturn<T, K>;
  }
  return undefined as PickReturn<T, K>;
};

const pickAOrB =
  <T, T2, P, P2>(vget: (v: T) => P | undefined, vget2: (v: T2) => P2 | undefined) =>
  (v: T | T2): P | P2 | undefined => {
    const p = vget(v as T);
    return p === undefined ? vget2(v as T2) : p;
  };

/**
 * An `OptionalLens<T, P>` grants type-safe access on potential `P`, hence it can be used to
 * get `P | undefined` from an arbitrary `T`, where `T` might be a union of arbitrary types.
 *
 * From an `OptionalLens<T, P>`, you can also retrieve a new `OptionalLens<P, P[K]>`, where K is a potential key of P.
 * Use `getLens<T>()` to get an initial `OptionalLens<T, T>`.
 *
 * You can see `OptionalLens` as "universal optional chaining". While normal optional chaining only works on a `T | null | undefined`,
 * the `OptionalLens` allows the type-safe access on arbitrary unions.
 *
 * E.g. given the following type and values:
 * ```ts
 * type TestChild = boolean | { x: number | Array<number> };
 * type Test =
 *   | number
 *   | {
 *       a: string | Array<boolean | TestChild>;
 *     };
 *
 *   const t1: Test = 42;
 *   const t2: Test = { a: 'Test3' };
 *   const t3: Test = { a: [true, { x: 7 }, { x: [1, 2, 3] }] };
 *   const t4: TestChild = { x: 7 };
 * ```
 *
 * you could get the following results with optional-lenses:
 * ```ts
 * const lensA = getLens<Test>().k('a');
 * const a1 = lensA.get(t1); // => undefined (inferred as undefined | string | Array<boolean | TestChild>)
 * const a2 = lensA.get(t2); // => 'Test3' (inferred as undefined | string | Array<boolean | TestChild>)
 * const a3 = lensA.get(t3); // => [true, { x: 7 }, { x: [1, 2, 3] }] (inferred as undefined | string | Array<boolean | TestChild>)
 *
 * const lensA2X1 = lensA.k(2).k('x').k(1);
 * const n1 = lensA2X1.get(t1); // => undefined (inferred as number | undefined)
 * const n2 = lensA2X1.get(t2); // => undefined (inferred as number | undefined)
 * const n3 = lensA2X1.get(t3); // => 2 (inferred as number | undefined)
 *
 * const lensB = getLens<Test>().compose(getLens<TestChild>());
 * const t3a = lensB.k('a').get(t3); // [true, { x: 7 }, { x: [1, 2, 3] }] (inferred as undefined | string | Array<boolean | TestChild>)
 * const t4x = lensB.k('x').get(t4); // 7 (inferred as undefined | number | Array<number>)
 * ```
 */
export type OptionalLens<T, P> = {
  get: (value: T) => P | undefined;
  k: <K extends ToKeys<P>>(key: K) => OptionalLens<T, PickReturn<P, K>>;
  compose: <T2, P2>(lens: OptionalLens<T2, P2>) => OptionalLens<T | T2, P | P2>;
};

const optionalLensKind = '$RXS_OptionalLens$';
type KindedOptionalLens<T, P> = OptionalLens<T, P> & {
  kind: typeof optionalLensKind;
};

/**
 * Typeguard to check, if the given value is an {@link OptionalLens}
 */
export const isOptionalLens = <T, P>(
  value: OptionalLens<T, P> | any,
): value is OptionalLens<T, P> => value?.kind === optionalLensKind;

const _toLens = <T, P>(get: (value: T) => P | undefined): KindedOptionalLens<T, P> => {
  return {
    kind: optionalLensKind,
    get,
    k: <K extends ToKeys<P>>(key: K): KindedOptionalLens<T, PickReturn<P, K>> =>
      _toLens<T, PickReturn<P, K>>((v: T): PickReturn<P, K> => pick(get(v), key)),
    compose: <T2, P2>(lens: OptionalLens<T2, P2>): OptionalLens<T | T2, P | P2> =>
      _toLens<T | T2, P | P2>(pickAOrB<T, T2, P, P2>(get, lens.get)),
  };
};

/**
 * Get an `OptionalLens<T, T>` for type-safe access on arbitrarily nested properties of type `T`,
 * where `T` might be a union of arbitrary types.
 *
 * Given the following type and values:
 * ```ts
 * type TestChild = boolean | { x: number | Array<number> };
 * type Test =
 *   | number
 *   | {
 *       a: string | Array<boolean | TestChild>;
 *     };
 *
 *   const t1: Test = 42;
 *   const t2: Test = { a: 'Test3' };
 *   const t3: Test = { a: [true, { x: 7 }, { x: [1, 2, 3] }] };
 *   const t4: TestChild = { x: 7 };
 * ```
 *
 * you could get the following results with optional-lenses:
 * ```ts
 * const lensA = getLens<Test>().k('a');
 * const a1 = lensA.get(t1); // => undefined (inferred as undefined | string | Array<boolean | TestChild>)
 * const a2 = lensA.get(t2); // => 'Test3' (inferred as undefined | string | Array<boolean | TestChild>)
 * const a3 = lensA.get(t3); // => [true, { x: 7 }, { x: [1, 2, 3] }] (inferred as undefined | string | Array<boolean | TestChild>)
 *
 * const lensA2X1 = lensA.k(2).k('x').k(1);
 * const n1 = lensA2X1.get(t1); // => undefined (inferred as number | undefined)
 * const n2 = lensA2X1.get(t2); // => undefined (inferred as number | undefined)
 * const n3 = lensA2X1.get(t3); // => 2 (inferred as number | undefined)
 *
 * const lensB = getLens<Test>().compose(getLens<TestChild>());
 * const t3a = lensB.k('a').get(t3); // [true, { x: 7 }, { x: [1, 2, 3] }] (inferred as undefined | string | Array<boolean | TestChild>)
 * const t4x = lensB.k('x').get(t4); // 7 (inferred as undefined | number | Array<number>)
 * ```
 */
export const getLens = <T>(): OptionalLens<T, T> => _toLens<T, T>((value: T) => value);

/**
 * Get a concrete `OptionalLens<T, P>` from an `OptionalLens<any, any>` (or never, if L is no `OptionalLens<any, any>`)
 */
export type ToLensType<L> = [L] extends [OptionalLens<infer T, infer P>]
  ? OptionalLens<T, P>
  : never;

/**
 * Get a concrete `T` from an `OptionalLens<T, any>` (or never, if L is no `OptionalLens<any, any>`)
 */
export type ToLensInputType<L> = [L] extends [OptionalLens<infer T, any>] ? T : never;

/**
 * Get a concrete `T` from an `OptionalLens<any, T>` (or never, if L is no `OptionalLens<any, any>`)
 */
export type ToLensOutputType<L> = [L] extends [OptionalLens<any, infer T>] ? T : never;

/**
 * Get `T`, if `VL` is an `OptionalLens<T, any>`, else get `OptionalLens<VL, any>`
 */
export type ValueOrLens<VL> = [VL] extends [OptionalLens<any, any>]
  ? ToLensInputType<VL>
  : OptionalLens<VL, any>;

/**
 * Get return type of `OptionalLens<T, PX>::get(T)`, if `X` is an `OptionalLens<any, any>`,
 * else get the return type of `OptionalLens<T, PY>::get(T)`, if `Y` is an `OptionalLens<any, any>`,
 * else never.
 */
export type FromLensReturn<X, Y> = [X] extends [OptionalLens<any, any>]
  ? ToLensOutputType<X> | undefined
  : [Y] extends [OptionalLens<any, any>]
  ? ToLensOutputType<Y> | undefined
  : never;

/**
 * Utility function to apply an `OptionalLens<T, P>` to a `T`
 */
export const fromValueAndLens =
  <T>(value: T) =>
  <L extends OptionalLens<T, any>>(lens: L): ToLensOutputType<L> | undefined =>
    lens.get(value);

/**
 * Utility function to apply a `T` to an `OptionalLens<T, P>`
 */
export const fromLensAndValue =
  <L extends OptionalLens<any, any>>(lens: L) =>
  <T extends ToLensInputType<L>>(value: T): ToLensOutputType<L> | undefined =>
    lens.get(value);

/**
 * If the first argument is an `OptionalLens`, this function behaves like `fromLensAndValue`,
 * else it behaves like `fromValueAndLens`
 */
export const fromLens =
  <X>(valueOrLens1: X) =>
  <Y extends ValueOrLens<X>>(valueOrLens2: Y): FromLensReturn<X, Y> =>
    isOptionalLens(valueOrLens1)
      ? valueOrLens1.get(valueOrLens2)
      : (<OptionalLens<X, any>>valueOrLens2).get(valueOrLens1);

/**
 * Return type of the toGetter function.
 * Like {@link OptionalLens}, a `Getter<T>` can be used for optional chaining on arbitrary union types.
 * In contrast to {@link OptionalLens}, the initial `Getter<T>` must be obtained from a value of type `T`.
 * You can thus use it as kind of ad-hoc lens for a one-time access. In most cases however,
 * using an {@link OptionalLens} is the better choice.
 *
 * See `toGetter` documentation for example usage.
 */
export type Getter<T> = {
  get: () => T;
  k: <K extends ToKeys<T>>(key: K) => Getter<PickReturn<T, K>>;
};

/**
 * Helper type to infer the concrete value type `T` wrapped by a `Getter<T>`
 */
export type ToGetterValue<T> = T extends Getter<infer V> ? V : never;

const _toGetter = <T>(g: () => T): Getter<T> => ({
  get: () => g(),
  k: <K extends ToKeys<T>>(key: K): Getter<PickReturn<T, K>> => _toGetter(() => pick(g(), key)),
});

/**
 * Wraps the given value of type T in a `Getter<T>`.
 * A `Getter<T>` can be used like a one-time ad-hoc version of an {@link OptionalLens}.
 * In most cases however, using an {@link OptionalLens} is the better choice.
 *
 * Given the following type and values:
 * ```ts
 * type Test =
 *   | number
 *   | {
 *       x: Array<number>;
 *       a: {
 *         b: number;
 *       };
 *   | {
 *       a: {
 *         b: string;
 *       }
 *     }
 * };
 *
 * let t1: Test = 42;
 * let t2: Test = { x: [1, 2, 3] };
 * let t3: Test = { a: { b: 'Test' } };
 * ```
 *
 * you could get the following results with toGetter:
 * ```ts
 * const b1 = toGetter(t1).k('a').k('b').get(); // => undefined (inferred as number | string | undefined)
 * const b2 = toGetter(t2).k('a').k('b').get(); // => undefined (inferred as number | string | undefined)
 * const b3 = toGetter(t3).k('a').k('b').get(); // => 'Test' (inferred as number | string | undefined)
 * const x1 = toGetter(t1).k('x').k(1).get(); // => undefined (inferred as number | undefined)
 * const x2 = toGetter(t2).k('x').k(1).get(); // => 2 (inferred as number | undefined)
 * const x3 = toGetter(t3).k('x').k(1).get(); // => undefined (inferred as number | undefined)
 * ```
 */
export const toGetter = <T>(value: T): Getter<T> => _toGetter<T>(() => value);
