import {
  fromLens,
  fromLensAndValue,
  fromValueAndLens,
  getLens,
  toGetter,
} from './../src/optional-lens';

describe('lenses and getter', () => {
  describe('optional property access', () => {
    type Test =
      | number
      | string
      | null
      | {
          a: number;
          b:
            | string
            | {
                c:
                  | Array<number>
                  | {
                      d: number;
                    };
              };
        };

    let t1: Test;
    let t2: Test;
    let t3: Test;
    let t4: Test;

    beforeEach(() => {
      t1 = 'Test1';
      t2 = {
        a: 42,
        b: 'Test2',
      };
      t3 = {
        a: 7,
        b: {
          c: {
            d: 9,
          },
        },
      };
      t4 = {
        a: 6,
        b: {
          c: [1, 2, 3],
        },
      };
    });

    describe('toGetter', () => {
      it('should get the base value', () => {
        expect(toGetter(t1).get()).toBe(t1);
        expect(toGetter(t2).get()).toBe(t2);
        expect(toGetter(t3).get()).toBe(t3);
        expect(toGetter(t4).get()).toBe(t4);
      });

      it('should get correct a', () => {
        expect(toGetter(t1).k('a').get()).toBe(undefined);
        expect(toGetter(t2).k('a').get()).toBe(42);
        expect(toGetter(t3).k('a').get()).toBe(7);
        expect(toGetter(t4).k('a').get()).toBe(6);
      });

      it('should get correct b', () => {
        expect(toGetter(t1).k('b').get()).toBe(undefined);
        expect(toGetter(t2).k('b').get()).toBe('Test2');
        expect(toGetter(t3).k('b').get()).toEqual({
          c: {
            d: 9,
          },
        });
        expect(toGetter(t4).k('b').get()).toEqual({
          c: [1, 2, 3],
        });
      });

      it('should get correct b.c', () => {
        expect(toGetter(t1).k('b').k('c').get()).toBe(undefined);
        expect(toGetter(t2).k('b').k('c').get()).toBe(undefined);
        expect(toGetter(t3).k('b').k('c').get()).toEqual({
          d: 9,
        });
        expect(toGetter(t4).k('b').k('c').get()).toEqual([1, 2, 3]);
      });

      it('should get correct b.c.d', () => {
        expect(toGetter(t1).k('b').k('c').k('d').get()).toBe(undefined);
        expect(toGetter(t2).k('b').k('c').k('d').get()).toBe(undefined);
        expect(toGetter(t3).k('b').k('c').k('d').get()).toEqual(9);
        expect(toGetter(t4).k('b').k('c').k('d').get()).toEqual(undefined);
      });

      it('should get correct b.c[n]', () => {
        expect(toGetter(t1).k('b').k('c').k(1).get()).toBe(undefined);
        expect(toGetter(t2).k('b').k('c').k(1).get()).toBe(undefined);
        expect(toGetter(t3).k('b').k('c').k(1).get()).toBe(undefined);
        expect(toGetter(t4).k('b').k('c').k(1).get()).toBe(2);
        expect(toGetter(t4).k('b').k('c').k(2).get()).toBe(3);
        expect(toGetter(t4).k('b').k('c').k(3).get()).toBe(undefined);
      });

      describe('union of two different records', () => {
        type Test2 =
          | number
          | {
              a: {
                b: number;
              };
            }
          | {
              a: {
                b: boolean;
              };
              x: string;
            };
        let t21: Test2;
        let t22: Test2;
        let t23: Test2;

        beforeEach(() => {
          t21 = 42;
          t22 = {
            a: {
              b: 7,
            },
          };
          t23 = {
            a: {
              b: true,
            },
            x: 'Test23',
          };
        });

        it('should get the base value', () => {
          expect(toGetter(t21).get()).toBe(t21);
          expect(toGetter(t22).get()).toBe(t22);
          expect(toGetter(t23).get()).toBe(t23);
        });

        it('should get correct a', () => {
          expect(toGetter(t21).k('a').get()).toBe(undefined);
          expect(toGetter(t22).k('a').get()).toEqual({
            b: 7,
          });
          expect(toGetter(t23).k('a').get()).toEqual({
            b: true,
          });
        });

        it('should get correct a.b', () => {
          expect(toGetter(t21).k('a').k('b').get()).toBe(undefined);
          expect(toGetter(t22).k('a').k('b').get()).toBe(7);
          expect(toGetter(t23).k('a').k('b').get()).toBe(true);
        });

        it('should get correct x', () => {
          expect(toGetter(t21).k('x').get()).toBe(undefined);
          expect(toGetter(t22).k('x').get()).toBe(undefined);
          expect(toGetter(t23).k('x').get()).toBe('Test23');
        });
      });
    });

    describe('getLens', () => {
      it('should get the base value', () => {
        const lens = getLens<Test>();
        expect(lens.get(t1)).toBe(t1);
        expect(lens.get(t2)).toBe(t2);
        expect(lens.get(t3)).toBe(t3);
        expect(lens.get(t4)).toBe(t4);
      });

      it('should get correct a', () => {
        const lens = getLens<Test>().k('a');
        expect(lens.get(t1)).toBe(undefined);
        expect(lens.get(t2)).toBe(42);
        expect(lens.get(t3)).toBe(7);
        expect(lens.get(t4)).toBe(6);
      });

      it('should get correct b', () => {
        const lens = getLens<Test>().k('b');
        expect(lens.get(t1)).toBe(undefined);
        expect(lens.get(t2)).toBe('Test2');
        expect(lens.get(t3)).toEqual({
          c: {
            d: 9,
          },
        });
        expect(lens.get(t4)).toEqual({
          c: [1, 2, 3],
        });
      });

      it('should get correct b.c', () => {
        const lens = getLens<Test>().k('b').k('c');
        expect(lens.get(t1)).toBe(undefined);
        expect(lens.get(t2)).toBe(undefined);
        expect(lens.get(t3)).toEqual({
          d: 9,
        });
        expect(lens.get(t4)).toEqual([1, 2, 3]);
      });

      it('should get correct b.c.d', () => {
        const lens = getLens<Test>().k('b').k('c').k('d');
        expect(lens.get(t1)).toBe(undefined);
        expect(lens.get(t2)).toBe(undefined);
        expect(lens.get(t3)).toEqual(9);
        expect(lens.get(t4)).toEqual(undefined);
      });

      it('should get correct b.c[n]', () => {
        const base = getLens<Test>().k('b').k('c');
        const lens1 = base.k(1);
        const lens2 = base.k(2);
        const lens3 = base.k(3);
        expect(lens1.get(t1)).toBe(undefined);
        expect(lens1.get(t2)).toBe(undefined);
        expect(lens1.get(t3)).toBe(undefined);
        expect(lens1.get(t4)).toBe(2);
        expect(lens2.get(t4)).toBe(3);
        expect(lens3.get(t4)).toBe(undefined);
      });

      describe('fromValueAndLens', () => {
        it('should get correct b.c[n]', () => {
          const base = getLens<Test>().k('b').k('c');
          const lens1 = base.k(1);
          const lens2 = base.k(2);
          const lens3 = base.k(3);
          expect(fromValueAndLens(t1)(lens1)).toBe(undefined);
          expect(fromValueAndLens(t2)(lens1)).toBe(undefined);
          expect(fromValueAndLens(t3)(lens1)).toBe(undefined);
          expect(fromValueAndLens(t4)(lens1)).toBe(2);
          expect(fromValueAndLens(t4)(lens2)).toBe(3);
          expect(fromValueAndLens(t4)(lens3)).toBe(undefined);
        });
      });

      describe('fromLensAndValue', () => {
        it('should get correct b.c[n]', () => {
          const base = getLens<Test>().k('b').k('c');
          const lens1 = base.k(1);
          const lens2 = base.k(2);
          const lens3 = base.k(3);
          expect(fromLensAndValue(lens1)(t1)).toBe(undefined);
          expect(fromLensAndValue(lens1)(t2)).toBe(undefined);
          expect(fromLensAndValue(lens1)(t3)).toBe(undefined);
          expect(fromLensAndValue(lens1)(t4)).toBe(2);
          expect(fromLensAndValue(lens2)(t4)).toBe(3);
          expect(fromLensAndValue(lens3)(t4)).toBe(undefined);
        });
      });

      describe('fromLens', () => {
        it('should get correct b.c[n]', () => {
          const base = getLens<Test>().k('b').k('c');
          const lens1 = base.k(1);
          const lens2 = base.k(2);
          const lens3 = base.k(3);

          expect(fromLens(lens1)(t1)).toBe(undefined);
          expect(fromLens(lens1)(t2)).toBe(undefined);
          expect(fromLens(lens1)(t3)).toBe(undefined);
          expect(fromLens(lens1)(t4)).toBe(2);
          expect(fromLens(lens2)(t4)).toBe(3);
          expect(fromLens(lens3)(t4)).toBe(undefined);

          expect(fromLens(t1)(lens1)).toBe(undefined);
          expect(fromLens(t2)(lens1)).toBe(undefined);
          expect(fromLens(t3)(lens1)).toBe(undefined);
          expect(fromLens(t4)(lens1)).toBe(2);
          expect(fromLens(t4)(lens2)).toBe(3);
          expect(fromLens(t4)(lens3)).toBe(undefined);
        });
      });

      describe('union of two different records', () => {
        type Test2 =
          | number
          | {
              a: {
                b: number;
              };
            }
          | {
              a: {
                b: boolean;
              };
              x: string;
            };
        let t21: Test2;
        let t22: Test2;
        let t23: Test2;

        beforeEach(() => {
          t21 = 42;
          t22 = {
            a: {
              b: 7,
            },
          };
          t23 = {
            a: {
              b: true,
            },
            x: 'Test23',
          };
        });

        it('should get the base value', () => {
          const lens = getLens<Test2>();
          expect(lens.get(t21)).toBe(t21);
          expect(lens.get(t22)).toBe(t22);
          expect(lens.get(t23)).toBe(t23);
        });

        it('should get correct a', () => {
          const lens = getLens<Test2>().k('a');
          expect(lens.get(t21)).toBe(undefined);
          expect(lens.get(t22)).toEqual({
            b: 7,
          });
          expect(lens.get(t23)).toEqual({
            b: true,
          });
        });

        it('should get correct a.b', () => {
          const lens = getLens<Test2>().k('a').k('b');
          expect(lens.get(t21)).toBe(undefined);
          expect(lens.get(t22)).toBe(7);
          expect(lens.get(t23)).toBe(true);
        });

        it('should get correct x', () => {
          const lens = getLens<Test2>().k('x');
          expect(lens.get(t21)).toBe(undefined);
          expect(lens.get(t22)).toBe(undefined);
          expect(lens.get(t23)).toBe('Test23');
        });
      });

      describe('object in array', () => {
        type Test3 =
          | number
          | {
              a:
                | string
                | Array<
                    | boolean
                    | {
                        x: number | Array<number>;
                      }
                  >;
            };
        let t31: Test3;
        let t32: Test3;
        let t33: Test3;

        beforeEach(() => {
          t31 = 42;
          t32 = {
            a: 'Test3',
          };
          t33 = {
            a: [true, { x: 7 }, { x: [1, 2, 3] }],
          };
        });

        it('should get correct a', () => {
          const lens = getLens<Test3>().k('a');
          expect(lens.get(t31)).toBe(undefined);
          expect(lens.get(t32)).toBe('Test3');
          expect(lens.get(t33)).toEqual([true, { x: 7 }, { x: [1, 2, 3] }]);
        });

        it('should get correct a[0]', () => {
          const lens = getLens<Test3>().k('a').k(0);
          expect(lens.get(t31)).toBe(undefined);
          expect(lens.get(t32)).toBe(undefined);
          expect(lens.get(t33)).toBe(true);
        });

        it('should get correct a[1]', () => {
          const lens = getLens<Test3>().k('a').k(1);
          expect(lens.get(t31)).toBe(undefined);
          expect(lens.get(t32)).toBe(undefined);
          expect(lens.get(t33)).toEqual({ x: 7 });
        });

        it('should get correct a[2].x[1]', () => {
          const lens = getLens<Test3>().k('a').k(2).k('x').k(1);
          expect(lens.get(t31)).toBe(undefined);
          expect(lens.get(t32)).toBe(undefined);
          expect(lens.get(t33)).toEqual(2);
        });
      });

      describe('lens composition', () => {
        type LT1 = null | { a: number; b: string; c: { c1: true; c2: { x: null | number } } };
        type LT2 = { a: boolean; c: { c1: false; c2: { y: number } } };
        type LT3 = LT1 | LT2;

        const t1: LT1 = { a: 42, b: 'bLT1', c: { c1: true, c2: { x: null } } } as LT1;
        const t2: LT2 = { a: false, c: { c1: false, c2: { y: 7 } } } as LT2;

        it('should work with individual lenses', () => {
          const lens1 = getLens<LT1>();
          const lens2 = getLens<LT2>();
          const lens3 = getLens<LT3>();

          expect(lens1.k('c').k('c2').k('x').get(t1)).toBe(null); // inferred as number | null | undefined
          // expect(lens1.k('c').k('c2').k('x').get(t2)).toBe(undefined); // must not compile!
          expect(lens3.k('c').k('c2').k('x').get(t2)).toBe(undefined); // inferred as number | null | undefined

          expect(lens2.k('c').k('c2').k('y').get(t2)).toBe(7); // inferred as number | undefined
          // expect(lens2.k('c').k('c2').k('y').get(t1)).toBe(undefined); // must not compile!
          expect(lens3.k('c').k('c2').k('y').get(t1)).toBe(undefined); // inferred as number | undefined
        });

        it('should compose lens3 from lens1 and lens2', () => {
          const lens1 = getLens<LT1>();
          const lens2 = getLens<LT2>();
          const lens3 = lens1.compose(lens2);

          expect(lens3.k('c').k('c2').k('x').get(t1)).toBe(null); // inferred as number | null | undefined
          expect(lens3.k('c').k('c2').k('x').get(t2)).toBe(undefined); // inferred as number | null | undefined

          expect(lens3.k('c').k('c2').k('y').get(t2)).toBe(7); // inferred as number | undefined
          expect(lens3.k('c').k('c2').k('y').get(t1)).toBe(undefined); // inferred as number | undefined

          expect(lens3.k('b').get(t1)).toBe('bLT1'); // inferred as string | undefined
          expect(lens3.k('b').get(t2)).toBe(undefined); // inferred as string | undefined
        });

        it('should compose lens3 from lens1 and lens2.k("c")', () => {
          const lens1 = getLens<LT1>();
          const lens2 = getLens<LT2>();
          const lens3 = lens1.compose(lens2.k('c'));

          expect(lens3.k('c').k('c2').k('x').get(t1)).toBe(null); // inferred as number | null | undefined
          expect(lens3.k('c').k('c2').k('x').get(t2)).toBe(undefined); // inferred as number | null | undefined
          // expect(lens3.k('c2').k('x').get(t1)).toBe(undefined); // must not compile!
          expect(lens3.k('c2').k('y').get(t1)).toBe(undefined); // inferred as number | undefined
          expect(lens3.k('c2').k('y').get(t2)).toBe(undefined); // inferred as number | undefined
        });

        it('should compose lens3 from lens1 and lens of child of LT2', () => {
          const lens1 = getLens<LT1>();
          const lens2 = getLens<{ c1: false; c2: { y: number } }>();
          const lens3 = lens1.compose(lens2);

          expect(lens3.k('c').k('c2').k('x').get(t1)).toBe(null); // inferred as number | null | undefined
          // expect(lens3.k('c').k('c2').k('x').get(t2)).toBe(undefined); // must not compile!
          expect(lens3.k('c2').k('y').get(t1)).toBe(undefined); // inferred as number | undefined
          expect(lens3.k('c2').k('y').get(t2.c)).toBe(7); // inferred as number | undefined
        });
      });
    });
  });

  describe('lens doc-strings', () => {
    type TestChild = boolean | { x: number | Array<number> };
    type Test =
      | number
      | {
          a: string | Array<boolean | TestChild>;
        };

    const t1: Test = 42;
    const t2: Test = { a: 'Test3' };
    const t3: Test = { a: [true, { x: 7 }, { x: [1, 2, 3] }] };
    const t4: TestChild = { x: 7 };

    it('should work as mentioned in the doc-strings', () => {
      const lensA = getLens<Test>().k('a');
      const a1 = lensA.get(t1); // => undefined (inferred as undefined | string | Array<boolean | TestChild>)
      const a2 = lensA.get(t2); // => 'Test3' (inferred as undefined | string | Array<boolean | TestChild>)
      const a3 = lensA.get(t3); // => [true, { x: 7 }, { x: [1, 2, 3] }] (inferred as undefined | string | Array<boolean | TestChild>)

      expect(a1).toBe(undefined);
      expect(a2).toBe('Test3');
      expect(a3).toEqual([true, { x: 7 }, { x: [1, 2, 3] }]);

      const lensA2X1 = lensA.k(2).k('x').k(1);
      const n1 = lensA2X1.get(t1); // => undefined (inferred as number | undefined)
      const n2 = lensA2X1.get(t2); // => undefined (inferred as number | undefined)
      const n3 = lensA2X1.get(t3); // => 2 (inferred as number | undefined)

      expect(n1).toBe(undefined);
      expect(n2).toBe(undefined);
      expect(n3).toBe(2);

      const lensB = getLens<Test>().compose(getLens<TestChild>());
      const t3a = lensB.k('a').get(t3); // [true, { x: 7 }, { x: [1, 2, 3] }] (inferred as undefined | string | Array<boolean | TestChild>)
      const t4x = lensB.k('x').get(t4); // 7 (inferred as undefined | number | Array<number>)

      expect(t3a).toEqual([true, { x: 7 }, { x: [1, 2, 3] }]);
      expect(t4x).toBe(7);
    });
  });
});
