type ConflictKeys<T1 extends Record<string, any>, T2 extends Record<string, any>> = {
  [K in keyof T1]: K extends keyof T2 ? K : never;
}[keyof T1];

type NoConflictKeys<T1 extends Record<string, any>, T2 extends Record<string, any>> = {
  [K in keyof T1]: K extends keyof T2 ? never : K;
}[keyof T1];

type Conflicts<T1 extends Record<string, any>, T2 extends Record<string, any>> = {
  [K in ConflictKeys<T1, T2>]: T1[K];
};

type NoConflicts<T1 extends Record<string, any>, T2 extends Record<string, any>> = {
  [K in NoConflictKeys<Omit<T1, 'conflicts1' | 'conflicts2'>, T2>]: T1[K];
};

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
 * This type represents the result of a merge of two Record<string, any> types, using the following rules:
 *  TODO
 *
 * @typedef {function} Merged<T1 extends Record<string, any>, T2 extends Record<string, any>> - result of merge for T1 and T2
 */
export type Merged<T1 extends Record<string, any>, T2 extends Record<string, any>> = Readonly<
  MergeResult<T1, T2>
>;

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

// ##########################################

export type Configuration = Readonly<Record<string, any>> | undefined;

export type MergedConfiguration<T1 extends Configuration, T2 extends Configuration> = T1 &
  T2 extends undefined
  ? undefined
  : Readonly<{
      c1: T1;
      c2: T2;
    }>;

// ##########################################

/*
type TestMerge<T1 extends Record<string, any>, T2 extends Record<string, any>> = Merged<T1, T2>;

const tmerged = <T1 extends Record<string, any>, T2 extends Record<string, any>>(
  t1: T1,
  t2: T2,
): TestMerge<T1, T2> => {
  return {} as TestMerge<T1, T2>;
};

type Test1 = {
  uniqueTest1: string;
  a: string;
};
type Test2 = {
  uniqueTest2: number;
  a: number;
};
type Test3 = {
  b: number;
};
type Test4 = {
  a: boolean;
  conflicts1: {
    a: number;
  };
};

const test1: Test1 = {
  uniqueTest1: 'test1',
  a: 'test1',
};
const test2: Test2 = {
  uniqueTest2: 242,
  a: 242,
};
const test3: Test3 = {
  b: 342,
};
const test4: Test4 = {
  a: true,
  conflicts1: {
    a: 442,
  },
};

const merged12: TestMerge<Test1, Test2> = tmerged(test1, test2); // prev.a: string
const merged13: TestMerge<Test1, Test3> = tmerged(test1, test3); // NO prev
const merged14: TestMerge<Test1, Test4> = tmerged(test1, test4); // prev.a: string
                                                                 // prev.prev2.a: number
const merged34: TestMerge<Test3, Test4> = tmerged(test3, test4); // prev.a: number
*/
