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
 * This type represents the result of a merge of two Record\<string, any\> types T1 and T2, using the following rules:
 *  a) If there are no conflicts between T1 and T2, then Merged\<T1, T2\> equals T1 & T2
 *  b) If there's a conflict between T1 and T2, then Merged\<T1, T2\> equals \{ conflicts1: ConflictsFromT1; conflicts2: ConflictsFromT2 \} & NoConflicts\<T1, T2\>
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
 * This function merges two Record\<string, any\> T1 and T2, resulting in Merged\<T1, T2\>
 *
 * @template T1 - type for the first argument
 * @template T2 - type for the second argument
 * @param {T1} t1 - first argument (extending Record\<string, any\>).
 * @param {T2} t2 - second argument (extending Record\<string, any\>).
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
 * Just a type alias for Record\<string, any\>
 */
export type Configuration = Record<string, any>;

/**
 * rx-signals internal helper type
 */
export type _NM<T1 extends Configuration, T2 extends Configuration> = T1 & T2;

/**
 * This type represents the result of a merge of two Configuration types T1 and T2, using the following rules:
 *  a) If either T1 or T2 is an empty object, then MergedConfiguration\<T1, T2\> equals T1 & T2
 *  b) If both, T1 and T2, are non-empty then MergedConfiguration\<T1, T2\> equals \{ c1: T1; c2: T2 \}
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
 * This type gives all keys of a Record T that map on a type VT.
 */
export type KeysOfValueType<T extends Record<string, any>, VT> = {
  [K in keyof T]: T[K] extends VT ? K : never;
}[keyof T];

/**
 * This type represents a subset of Record T that contains only entries with a value that extends VT.
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
 * Type corresponding to ResultWithInput, but with potential NO_VALUE for result and/or resultInput
 */
export type MaybeResultWithInput<Input, Result> = {
  /** the received result */
  result: Result | NoValueType;

  /** the input that produced the result */
  resultInput: Input | NoValueType;
};

/**
 * Typeguard to check if a MaybeResultWithInput is ResultWithInput
 */
export const isResultWithInput = <Input, Result>(
  mrwi: MaybeResultWithInput<Input, Result>,
): mrwi is ResultWithInput<Input, Result> =>
  mrwi.result !== NO_VALUE && mrwi.resultInput !== NO_VALUE;

/**
 * A recursive Partial\<Record\<string, any\>\> type
 */
export type DeepPartial<T> = [T] extends [Record<string, any>]
  ? {
      [K in keyof T]?: DeepPartial<T[K]>;
    }
  : T;

/**
 * Constructs a validation type for the model type T, where the validation
 * type is a deep-partial model type where each key maps to null/undefined (representing valid state)
 * or V (representing an error).
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
 * A helper function to patch an existing ModelValidationResult.
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
 * A helper function to check if a ModelValidationResult represents a valid state.
 */
export const isValidModelValidationResult = <T>(
  modelValidationResult: ModelValidationResult<T, any>,
): boolean => {
  if (modelValidationResult) {
    if (isRecord(modelValidationResult)) {
      return !Object.values(modelValidationResult).find(
        value => !isValidModelValidationResult(value),
      );
    }
    return false;
  }
  return true;
};
