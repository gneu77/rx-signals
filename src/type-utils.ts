/**
 * @internal
 */
type ConflictKeys<T1 extends Record<string, any>, T2 extends Record<string, any>> = {
  [K in keyof T1]: K extends keyof T2 ? K : never;
}[keyof T1];

/**
 * @internal
 */
type NoConflictKeys<T1 extends Record<string, any>, T2 extends Record<string, any>> = {
  [K in keyof T1]: K extends keyof T2 ? never : K;
}[keyof T1];

/**
 * @internal
 */
type Conflicts<T1 extends Record<string, any>, T2 extends Record<string, any>> = {
  [K in ConflictKeys<T1, T2>]: T1[K];
};

/**
 * @internal
 */
type NoConflicts<T1 extends Record<string, any>, T2 extends Record<string, any>> = {
  [K in NoConflictKeys<Omit<T1, 'conflicts1' | 'conflicts2'>, T2>]: T1[K];
};

/**
 * @internal
 */
type MergeResult<T1 extends Record<string, any>, T2 extends Record<string, any>> = ConflictKeys<
  T1,
  T2
> extends never
  ? T1 & T2
  : NoConflicts<T1, T2> &
      NoConflicts<T2, T1> & {
        conflicts1: Conflicts<T1, T2> &
          ('conflicts1' extends keyof T1 ? { conflicts1: T1['conflicts1'] } : {}) &
          ('conflicts2' extends keyof T1 ? { conflicts2: T1['conflicts2'] } : {});
        conflicts2: Conflicts<T2, T1> &
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
export type Merged<T1 extends Record<string, any>, T2 extends Record<string, any>> = MergeResult<
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
 * @internal
 */
type NM<T1 extends Configuration, T2 extends Configuration> = T1 & T2;

/**
 * This type represents the result of a merge of two Configuration types T1 and T2, using the following rules:
 *  a) If either T1 or T2 is an empty object, then MergedConfiguration\<T1, T2\> equals T1 & T2
 *  b) If both, T1 and T2, are non-empty then MergedConfiguration\<T1, T2\> equals \{ c1: T1; c2: T2 \}
 */
export type MergedConfiguration<
  T1 extends Configuration,
  T2 extends Configuration,
> = keyof T1 extends never
  ? NM<T1, T2>
  : keyof T2 extends never
  ? NM<T1, T2>
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
 * This type represent a subset of Record T that contains only entries with a value that extends VT.
 */
export type WithValueType<T extends Record<string, any>, VT> = {
  [K in KeysOfValueType<T, VT>]: T[K];
};
