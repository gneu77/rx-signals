import { toGetter } from './../src/type-utils';

describe('type utiles', () => {
  describe('toGetter', () => {
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
  });
});
