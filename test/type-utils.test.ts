import { getLens, toGetter } from './../src/type-utils';

describe('type utiles', () => {
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
        expect(toGetter(t1)('a').get()).toBe(undefined);
        expect(toGetter(t2)('a').get()).toBe(42);
        expect(toGetter(t3)('a').get()).toBe(7);
        expect(toGetter(t4)('a').get()).toBe(6);
      });

      it('should get correct b', () => {
        expect(toGetter(t1)('b').get()).toBe(undefined);
        expect(toGetter(t2)('b').get()).toBe('Test2');
        expect(toGetter(t3)('b').get()).toEqual({
          c: {
            d: 9,
          },
        });
        expect(toGetter(t4)('b').get()).toEqual({
          c: [1, 2, 3],
        });
      });

      it('should get correct b.c', () => {
        expect(toGetter(t1)('b')('c').get()).toBe(undefined);
        expect(toGetter(t2)('b')('c').get()).toBe(undefined);
        expect(toGetter(t3)('b')('c').get()).toEqual({
          d: 9,
        });
        expect(toGetter(t4)('b')('c').get()).toEqual([1, 2, 3]);
      });

      it('should get correct b.c.d', () => {
        expect(toGetter(t1)('b')('c')('d').get()).toBe(undefined);
        expect(toGetter(t2)('b')('c')('d').get()).toBe(undefined);
        expect(toGetter(t3)('b')('c')('d').get()).toEqual(9);
        expect(toGetter(t4)('b')('c')('d').get()).toEqual(undefined);
      });

      it('should get correct b.c[n]', () => {
        expect(toGetter(t1)('b')('c')(1).get()).toBe(undefined);
        expect(toGetter(t2)('b')('c')(1).get()).toBe(undefined);
        expect(toGetter(t3)('b')('c')(1).get()).toBe(undefined);
        expect(toGetter(t4)('b')('c')(1).get()).toBe(2);
        expect(toGetter(t4)('b')('c')(2).get()).toBe(3);
        expect(toGetter(t4)('b')('c')(3).get()).toBe(undefined);
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
          expect(toGetter(t21)('a').get()).toBe(undefined);
          expect(toGetter(t22)('a').get()).toEqual({
            b: 7,
          });
          expect(toGetter(t23)('a').get()).toEqual({
            b: true,
          });
        });

        it('should get correct a.b', () => {
          expect(toGetter(t21)('a')('b').get()).toBe(undefined);
          expect(toGetter(t22)('a')('b').get()).toBe(7);
          expect(toGetter(t23)('a')('b').get()).toBe(true);
        });

        it('should get correct x', () => {
          expect(toGetter(t21)('x').get()).toBe(undefined);
          expect(toGetter(t22)('x').get()).toBe(undefined);
          expect(toGetter(t23)('x').get()).toBe('Test23');
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
        const lens = getLens<Test>()('a');
        expect(lens.get(t1)).toBe(undefined);
        expect(lens.get(t2)).toBe(42);
        expect(lens.get(t3)).toBe(7);
        expect(lens.get(t4)).toBe(6);
      });

      it('should get correct b', () => {
        const lens = getLens<Test>()('b');
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
        const lens = getLens<Test>()('b')('c');
        expect(lens.get(t1)).toBe(undefined);
        expect(lens.get(t2)).toBe(undefined);
        expect(lens.get(t3)).toEqual({
          d: 9,
        });
        expect(lens.get(t4)).toEqual([1, 2, 3]);
      });

      it('should get correct b.c.d', () => {
        const lens = getLens<Test>()('b')('c')('d');
        expect(lens.get(t1)).toBe(undefined);
        expect(lens.get(t2)).toBe(undefined);
        expect(lens.get(t3)).toEqual(9);
        expect(lens.get(t4)).toEqual(undefined);
      });

      it('should get correct b.c[n]', () => {
        const base = getLens<Test>()('b')('c');
        const lens1 = base(1);
        const lens2 = base(2);
        const lens3 = base(3);
        expect(lens1.get(t1)).toBe(undefined);
        expect(lens1.get(t2)).toBe(undefined);
        expect(lens1.get(t3)).toBe(undefined);
        expect(lens1.get(t4)).toBe(2);
        expect(lens2.get(t4)).toBe(3);
        expect(lens3.get(t4)).toBe(undefined);
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
          const lens = getLens<Test2>()('a');
          expect(lens.get(t21)).toBe(undefined);
          expect(lens.get(t22)).toEqual({
            b: 7,
          });
          expect(lens.get(t23)).toEqual({
            b: true,
          });
        });

        it('should get correct a.b', () => {
          const lens = getLens<Test2>()('a')('b');
          expect(lens.get(t21)).toBe(undefined);
          expect(lens.get(t22)).toBe(7);
          expect(lens.get(t23)).toBe(true);
        });

        it('should get correct x', () => {
          const lens = getLens<Test2>()('x');
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
          const lens = getLens<Test3>()('a');
          expect(lens.get(t31)).toBe(undefined);
          expect(lens.get(t32)).toBe('Test3');
          expect(lens.get(t33)).toEqual([true, { x: 7 }, { x: [1, 2, 3] }]);
        });

        it('should get correct a[0]', () => {
          const lens = getLens<Test3>()('a')(0);
          expect(lens.get(t31)).toBe(undefined);
          expect(lens.get(t32)).toBe(undefined);
          expect(lens.get(t33)).toBe(true);
        });

        it('should get correct a[1]', () => {
          const lens = getLens<Test3>()('a')(1);
          expect(lens.get(t31)).toBe(undefined);
          expect(lens.get(t32)).toBe(undefined);
          expect(lens.get(t33)).toEqual({ x: 7 });
        });

        it('should get correct a[2].x[1]', () => {
          const lens = getLens<Test3>()('a')(2)('x')(1);
          expect(lens.get(t31)).toBe(undefined);
          expect(lens.get(t32)).toBe(undefined);
          expect(lens.get(t33)).toEqual(2);
        });
      });
    });
  });
});
