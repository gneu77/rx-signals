/* eslint-disable @typescript-eslint/naming-convention */
import { NO_VALUE, NoValueType } from './store-utils';

/**
 * rx-signals internal helper type
 */
export type _ConflictKeys<T1 extends Record<string, any>, T2 extends Record<string, any>> = {
  [K in keyof T1]: K extends keyof T2 ? K : never;
}[keyof T1];

/**
 * rx-signals internal helper type
 */
export type _NoConflictKeys<T1 extends Record<string, any>, T2 extends Record<string, any>> = {
  [K in keyof T1]: K extends keyof T2 ? never : K;
}[keyof T1];

/**
 * rx-signals internal helper type
 */
export type _Conflicts<T1 extends Record<string, any>, T2 extends Record<string, any>> = {
  [K in _ConflictKeys<T1, T2>]: T1[K];
};

/**
 * rx-signals internal helper type
 */
export type _NoConflicts<T1 extends Record<string, any>, T2 extends Record<string, any>> = {
  [K in _NoConflictKeys<Omit<T1, 'conflicts1' | 'conflicts2'>, T2>]: T1[K];
};

/**
 * rx-signals internal helper type
 */
export type _MergeResult<
  T1 extends Record<string, any>,
  T2 extends Record<string, any>,
> = _ConflictKeys<T1, T2> extends never
  ? T1 & T2
  : _NoConflicts<T1, T2> &
      _NoConflicts<T2, T1> & {
        conflicts1: _Conflicts<T1, T2> &
          ('conflicts1' extends keyof T1 ? { conflicts1: T1['conflicts1'] } : {}) &
          ('conflicts2' extends keyof T1 ? { conflicts2: T1['conflicts2'] } : {});
        conflicts2: _Conflicts<T2, T1> &
          ('conflicts1' extends keyof T2 ? { conflicts1: T2['conflicts1'] } : {}) &
          ('conflicts2' extends keyof T2 ? { conflicts2: T2['conflicts2'] } : {});
      };

/**
 * This type represents the result of a merge of two `Record<string, any>` types T1 and T2, using the following rules:
 *  a) If there are no conflicts between T1 and T2, then `Merged<T1, T2>` equals `T1 & T2`
 *  b) If there's a conflict between T1 and T2, then `Merged<T1, T2>` equals `{ conflicts1: ConflictsFromT1; conflicts2: ConflictsFromT2 } & NoConflicts<T1, T2>`
 *
 * Here are some examples:
 * ```ts
 *    Merged<{
 *      a: string;
 *    }, {
 *      b: number;
 *      c: string;
 *    }> = {
 *      a: string;
 *      b: number;
 *      c: string;
 *    }
 *
 *    Merged<{
 *      a: string;
 *    }, {
 *      a: number;
 *      c: string;
 *    }> = {
 *      conflicts1: {
 *        a: string;
 *      };
 *      conflicts2: {
 *        a: number;
 *      };
 *      c: string;
 *    }
 * ```
 *
 * ```ts
 *    Merged<{
 *      conflicts1: {
 *        a: string;
 *      };
 *      conflicts2: {
 *        a: number;
 *      };
 *      c: string;
 *    }, {
 *      a: boolean;
 *      c: boolean;
 *    }> = {
 *      conflicts1: {
 *        conflicts1: {
 *          a: string;
 *        };
 *        conflicts2: {
 *          a: number;
 *        };
 *        c: string;
 *      };
 *      conflicts2: {
 *        c: boolean;
 *      };
 *      a: boolean;
 *    }
 * ```
 */
export type Merged<T1 extends Record<string, any>, T2 extends Record<string, any>> = _MergeResult<
  T1,
  T2
>;

/**
 * This function merges two `Record<string, any>` T1 and T2, resulting in `Merged<T1, T2>`
 *
 * @template T1 - type for the first argument
 * @template T2 - type for the second argument
 * @param {T1} t1 - first argument (extending `Record<string, any>`).
 * @param {T2} t2 - second argument (extending `Record<string, any>`).
 * @returns {Merged}
 */
export const merge = <T1 extends Record<string, any>, T2 extends Record<string, any>>(
  t1: T1,
  t2: T2,
): Merged<T1, T2> => {
  const result: Record<string, any> = {};
  const t1c1 = t1.conflicts1 ?? null;
  const t1c2 = t1.conflicts2 ?? null;
  const t2c1 = t2.conflicts1 ?? null;
  const t2c2 = t2.conflicts2 ?? null;
  const c1: Record<string, any> = {};
  const c2: Record<string, any> = {};
  let hasConflicts = false;
  Object.entries(t1).forEach(([k, v]) => {
    if (k !== 'conflicts1' && k !== 'conflicts2') {
      if (t2[k]) {
        c1[k] = v;
        hasConflicts = true;
      } else {
        result[k] = v;
      }
    }
  });
  Object.entries(t2).forEach(([k, v]) => {
    if (k !== 'conflicts1' && k !== 'conflicts2') {
      if (t1[k]) {
        c2[k] = v;
      } else {
        result[k] = v;
      }
    }
  });
  if (hasConflicts || (t1c1 !== null && t2c1 !== null) || (t1c2 !== null && t2c2 !== null)) {
    result.conflicts1 = c1;
    if (t1c1 !== null) {
      result.conflicts1.conflicts1 = t1c1;
    }
    if (t1c2 !== null) {
      result.conflicts1.conflicts2 = t1c2;
    }
    result.conflicts2 = c2;
    if (t2c1 !== null) {
      result.conflicts2.conflicts1 = t2c1;
    }
    if (t2c2 !== null) {
      result.conflicts2.conflicts2 = t2c2;
    }
  } else {
    if (t1c1 !== null) {
      result.conflicts1 = t1c1;
    }
    if (t1c2 !== null) {
      result.conflicts2 = t1c2;
    }
    if (t2c1 !== null) {
      result.conflicts1 = t2c1;
    }
    if (t2c2 !== null) {
      result.conflicts2 = t2c2;
    }
  }
  return result as Merged<T1, T2>;
};

/**
 * Just a type alias for `Record<string, any>`
 */
export type Configuration = Record<string, any>;

/**
 * rx-signals internal helper type
 */
export type _NM<T1 extends Configuration, T2 extends Configuration> = T1 & T2;

/**
 * This type represents the result of a merge of two `Configuration` types `T1` and `T2`, using the following rules:
 *  a) If either `T1` or `T2` is an empty object, then `MergedConfiguration<T1, T2>` equals `T1 & T2`
 *  b) If both, `T1` and `T2`, are non-empty then `MergedConfiguration<T1, T2>` equals `{ c1: T1; c2: T2 }`
 */
export type MergedConfiguration<
  T1 extends Configuration,
  T2 extends Configuration,
> = keyof T1 extends never
  ? _NM<T1, T2>
  : keyof T2 extends never
  ? _NM<T1, T2>
  : {
      c1: T1;
      c2: T2;
    };

/**
 * This type gives all keys of a Record T that map on a type `VT`.
 */
export type KeysOfValueType<T extends Record<string, any>, VT> = {
  [K in keyof T]: T[K] extends VT ? K : never;
}[keyof T];

/**
 * This type represents a subset of Record T that contains only entries with a value that extends `VT`.
 */
export type WithValueType<T extends Record<string, any>, VT> = {
  [K in KeysOfValueType<T, VT>]: T[K];
};

/**
 * Type representing a result combined with the input that led to the result.
 * Coupling input and result is important for the results of async processes.
 *
 * @template Input - specifies the input type
 * @template Result - specifies the result type
 */
export type ResultWithInput<Input, Result> = {
  /** the received result */
  result: Result;

  /** the input that produced the result */
  resultInput: Input;
};

/**
 * Type corresponding to `ResultWithInput`, but with potential `NO_VALUE` for result and/or resultInput
 */
export type MaybeResultWithInput<Input, Result> = {
  /** the received result */
  result: Result | NoValueType;

  /** the input that produced the result */
  resultInput: Input | NoValueType;
};

/**
 * Typeguard to check if a `MaybeResultWithInput` is `ResultWithInput`
 */
export const isResultWithInput = <Input, Result>(
  mrwi: MaybeResultWithInput<Input, Result>,
): mrwi is ResultWithInput<Input, Result> =>
  mrwi.result !== NO_VALUE && mrwi.resultInput !== NO_VALUE;

/**
 * A recursive `Partial<Record<string, any>>` type
 */
export type DeepPartial<T> = [T] extends [Record<string, any>]
  ? {
      [K in keyof T]?: DeepPartial<T[K]>;
    }
  : T;

/**
 * Constructs a validation type for the model type `T`, where the validation
 * type is a deep-partial model type where each key maps to null/undefined (representing valid state)
 * or `V` (representing an error).
 */
export type ModelValidationResult<T, V = string> = [T] extends [Record<string, any>]
  ?
      | V
      | null
      | undefined
      | {
          [K in keyof T]?: null | V | ModelValidationResult<T[K]>;
        }
  : V | null | undefined;

const isRecord = (value: any): value is Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value);

/**
 * A helper function to patch an existing `ModelValidationResult`.
 */
export const patchModelValidationResult = <T, V>(
  model: null | ModelValidationResult<T, V>,
  patch: ModelValidationResult<T, V>,
): ModelValidationResult<T, V> =>
  isRecord(model) && isRecord(patch)
    ? Object.entries(patch).reduce(
        (acc, [key, value]) => ({
          ...acc,
          [key]: isRecord(acc?.[key]) ? patchModelValidationResult(acc[key], value) : value,
        }),
        model,
      )
    : patch;

/**
 * A helper function to check if a `ModelValidationResult` represents a valid state.
 */
export const isValidModelValidationResult = <T>(
  modelValidationResult: ModelValidationResult<T, any>,
): boolean => {
  if ((modelValidationResult ?? null) !== null) {
    if (isRecord(modelValidationResult)) {
      return !Object.values(modelValidationResult).find(
        value => !isValidModelValidationResult(value),
      );
    }
    return false;
  }
  return true;
};

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
export const pick = <T, K extends ToKeys<T>>(value: T, key: K): PickReturn<T, K> => {
  if (Array.isArray(value)) {
    return value[key];
  }
  if (value !== null && typeof value === 'object') {
    return (<Record<K, any>>value)[key] as PickReturn<T, K>;
  }
  return undefined as PickReturn<T, K>;
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
 * type Test =
 *        | number
 *        | {
 *            a:
 *              | string
 *              | Array<
 *                  | boolean
 *                  | {
 *                      x: number | Array<number>;
 *                    }
 *                >;
 *          };
 *
 * const t1: Test = 42;
 * const t2: Test = { a: 'Test3' };
 * const t3: Test = { a: [true, { x: 7 }, { x: [1, 2, 3] }] };
 * ```
 *
 * you could get the following results with optional-lenses:
 * ```ts
 * const lensA = getLens<Test>().k('a');
 * const a1 = lensA.get(t1); // => undefined (inferred as undefined | string | Array<boolean | { x: number | Array<number>}>)
 * const a2 = lensA.get(t2); // => 'Test3' (inferred as undefined | string | Array<boolean | { x: number | Array<number>}>)
 * const a3 = lensA.get(t3); // => [true, { x: 7 }, { x: [1, 2, 3] }] (inferred as undefined | string | Array<boolean | { x: number | Array<number>}>)
 *
 * const lensA2X1 = lensA.k(2).k('x').k(1);
 * const n1 = lensA2X1.get(t1); // => undefined (inferred as number | undefined)
 * const n2 = lensA2X1.get(t2); // => undefined (inferred as number | undefined)
 * const n3 = lensA2X1.get(t3); // => 2 (inferred as number | undefined)
 * ```
 */
export type OptionalLens<T, P> = {
  get: (value: T) => P | undefined;
  k: <K extends ToKeys<P>>(key: K) => OptionalLens<T, PickReturn<P, K>>;
};

const _toLens = <T, P, K extends ToKeys<P>>(
  get: (value: T) => P,
  key: K,
): OptionalLens<T, PickReturn<P, K>> => {
  const newGet = (v: T): PickReturn<P, K> => pick(get(v), key);
  return {
    get: newGet,
    k: <NK extends ToKeys<PickReturn<P, K>>>(
      k: NK,
    ): OptionalLens<T, PickReturn<PickReturn<P, K>, NK>> =>
      _toLens<T, PickReturn<P, K>, NK>(newGet, k),
  };
};

/**
 * Get an `OptionalLens<T, T>` for type-safe access on arbitrarily nested properties of type `T`,
 * where `T` might be a union of arbitrary types.
 *
 * Given the following type and values:
 * ```ts
 * type Test =
 *        | number
 *        | {
 *            a:
 *              | string
 *              | Array<
 *                  | boolean
 *                  | {
 *                      x: number | Array<number>;
 *                    }
 *                >;
 *          };
 *
 * const t1: Test = 42;
 * const t2: Test = { a: 'Test3' };
 * const t3: Test = { a: [true, { x: 7 }, { x: [1, 2, 3] }] };
 * ```
 *
 * you could get the following results with optional-lenses:
 * ```ts
 * const lensA = getLens<Test>().k('a');
 * const a1 = lensA.get(t1); // => undefined (inferred as undefined | string | Array<boolean | { x: number | Array<number>}>)
 * const a2 = lensA.get(t2); // => 'Test3' (inferred as undefined | string | Array<boolean | { x: number | Array<number>}>)
 * const a3 = lensA.get(t3); // => [true, { x: 7 }, { x: [1, 2, 3] }] (inferred as undefined | string | Array<boolean | { x: number | Array<number>}>)
 *
 * const lensA2X1 = lensA.k(2).k('x').k(1);
 * const n1 = lensA2X1.get(t1); // => undefined (inferred as number | undefined)
 * const n2 = lensA2X1.get(t2); // => undefined (inferred as number | undefined)
 * const n3 = lensA2X1.get(t3); // => 2 (inferred as number | undefined)
 * ```
 */
export const getLens = <T>(): OptionalLens<T, T> => {
  const get = (value: T) => value;
  return {
    get,
    k: <K extends ToKeys<T>>(key: K): OptionalLens<T, PickReturn<T, K>> =>
      _toLens<T, T, K>(get, key),
  };
};

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
