import { BehaviorSubject, combineLatest, of, Subject } from 'rxjs';
import { debounceTime, filter, map, skip, switchMap, take, withLatestFrom } from 'rxjs/operators';
import { Store, TypeIdentifier } from '../src/store';

describe('Store', () => {
  let store: Store;
  let stringBehavior: BehaviorSubject<string>;
  let stringEventSource: Subject<string>;

  beforeEach(() => {
    store = new Store();
    stringBehavior = new BehaviorSubject<string>('INITIAL_VALUE');
    stringEventSource = new Subject<string>();
  });

  describe('addStatelessBehavior', () => {
    it('should throw, if behavior with given identifier already exists', () => {
      const id = { symbol: Symbol('TEST') };
      store.addStatelessBehavior(id, stringBehavior.asObservable());
      expect(() => {
        store.addStatelessBehavior(id, stringBehavior.asObservable());
      }).toThrowError(
        'A behavior or event source with the given identifier was already added with a source: Symbol(TEST)',
      );
    });

    it('should work', () => {
      expect(() => {
        store.addStatelessBehavior({ symbol: Symbol('TEST') }, stringBehavior.asObservable());
      }).not.toThrow();
    });
  });

  describe('addStatefulBehavior', () => {
    it('should throw, if behavior with given identifier already exists', () => {
      const id = { symbol: Symbol('TEST') };
      store.addStatefulBehavior(id, stringBehavior.asObservable());
      expect(() => {
        store.addStatefulBehavior(id, stringBehavior.asObservable());
      }).toThrowError(
        'A behavior or event source with the given identifier was already added with a source: Symbol(TEST)',
      );
    });

    it('should work', () => {
      expect(() => {
        store.addStatefulBehavior({ symbol: Symbol('TEST') }, stringBehavior.asObservable());
      }).not.toThrow();
    });
  });

  describe('removeBehavior', () => {
    it('should work', () => {
      expect(() => {
        store.removeBehavior({ symbol: Symbol('TEST') });
      }).not.toThrow();
    });
  });

  describe('getBehavior', () => {
    it('should work', () => {
      const behavior = store.getBehavior({ symbol: Symbol('TEST') });
      expect(typeof behavior.pipe).toBe('function');
    });
  });

  describe('getEventStream', () => {
    it('should work', () => {
      const eventStream = store.getEventStream({ symbol: Symbol('TEST') });
      expect(typeof eventStream.pipe).toBe('function');
    });
  });

  describe('dispatchEvent', () => {
    it('should work', () => {
      expect(() => {
        store.dispatchEvent({ symbol: Symbol('TEST') }, 'test');
      }).not.toThrow();
    });
  });

  describe('addEventSource', () => {
    it('should throw, if event source with given identifier already exists', () => {
      const id = { symbol: Symbol('TEST') };
      const sourceId = Symbol('testSource');
      store.addEventSource(sourceId, id, stringEventSource.asObservable());
      expect(() => {
        store.addEventSource(sourceId, id, stringEventSource.asObservable());
      }).toThrowError('A source with the given ID has already been added.: Symbol(testSource)');
    });

    it('should work', () => {
      expect(() => {
        const sourceId = Symbol('testSource');
        store.addEventSource(
          sourceId,
          { symbol: Symbol('TEST') },
          stringEventSource.asObservable(),
        );
      }).not.toThrow();
    });
  });

  describe('removeEventSource', () => {
    it('should work', () => {
      expect(() => {
        store.removeEventSource(Symbol('testSource'));
      }).not.toThrow();
    });
  });

  describe('complex', () => {
    it('should receive dispatched events', done => {
      const identifier: TypeIdentifier<string> = {
        symbol: Symbol('TEST'),
      };
      store.getEventStream(identifier).subscribe(val => {
        expect(val).toBe('Hello');
        done();
      });
      store.dispatchEvent(identifier, 'Hello');
    });

    describe('lazy behaviors and effects: adding query behavior', () => {
      const QUERY_BEHAVIOR: TypeIdentifier<string> = { symbol: Symbol('QueryBehavior') };
      interface ResultType {
        result: number[];
        resultQuery: string | null;
      }
      const RESULT_BEHAVIOR: TypeIdentifier<ResultType> = { symbol: Symbol('ResultBehavior') };
      const QUERY_EVENT: TypeIdentifier<string> = { symbol: Symbol('QueryEvent') };
      const RESULT_EVENT: TypeIdentifier<ResultType> = { symbol: Symbol('ResultEvent') };

      beforeEach(() => {
        store.addStatelessBehavior(QUERY_BEHAVIOR, store.getEventStream(QUERY_EVENT), null);
      });

      describe('lazy behaviors and effects: adding result behavior', () => {
        beforeEach(() => {
          store.addStatelessBehavior(RESULT_BEHAVIOR, store.getEventStream(RESULT_EVENT), {
            result: [],
            resultQuery: null,
          });
        });

        describe('lazy behaviors and effects: adding query effect as event source', () => {
          beforeEach(() => {
            const eventSource = combineLatest([
              store.getBehavior(QUERY_BEHAVIOR),
              store.getBehavior(RESULT_BEHAVIOR),
            ]).pipe(
              filter(pair => pair[0] !== pair[1].resultQuery),
              debounceTime(150),
              switchMap(pair => of({ result: [1, 2, 3], resultQuery: pair[0] })),
            );
            store.addEventSource(Symbol('RESULT_EVENT_SOURCE'), RESULT_EVENT, eventSource);
          });

          it('should have a current value for the result behavior', done => {
            store
              .getBehavior(RESULT_BEHAVIOR)
              .pipe(take(1))
              .subscribe(result => {
                expect(result.resultQuery).toBe(null);
                expect(Array.isArray(result.result)).toBe(true);
                expect(result.result.length).toBe(0);
                done();
              });
          });
        });
      });
    });

    describe('reduce and reset', () => {
      interface Query {
        firstName: string | null;
        lastName: string | null;
      }
      interface ResultType {
        result: number[];
        resultQuery: Query | null;
      }
      const QUERY_BEHAVIOR: TypeIdentifier<Query> = { symbol: Symbol('QUERY_BEHAVIOR') };
      const QUERY_EVENT: TypeIdentifier<Partial<Query>> = { symbol: Symbol('QUERY_EVENT') };
      const RESULT_EFFECT = Symbol('RESULT_EFFECT');
      const RESULT_EVENT: TypeIdentifier<ResultType> = { symbol: Symbol('RESULT_EVENT') };
      const RESULT_BEHAVIOR: TypeIdentifier<ResultType> = { symbol: Symbol('RESULT_BEHAVIOR') };

      beforeEach(() => {
        store.addStatefulBehavior(
          QUERY_BEHAVIOR,
          store.getTypedEventStream(QUERY_EVENT).pipe(
            withLatestFrom(store.getBehavior(QUERY_BEHAVIOR)),
            map(([queryEvent, currentQuery]) => ({
              ...currentQuery,
              ...queryEvent.event,
            })),
          ),
          {
            firstName: null,
            lastName: null,
          },
        );

        store.addStatelessBehavior(RESULT_BEHAVIOR, store.getEventStream(RESULT_EVENT), {
          result: [],
          resultQuery: null,
        });

        const eventSource = combineLatest([
          store.getBehavior(QUERY_BEHAVIOR),
          store.getBehavior(RESULT_BEHAVIOR),
        ]).pipe(
          filter(pair => pair[0] !== pair[1].resultQuery),
          switchMap(pair => of({ result: [1, 2, 3], resultQuery: pair[0] })),
        );
        store.addEventSource(RESULT_EFFECT, RESULT_EVENT, eventSource);
      });

      it('should have correct initial state for query', done => {
        store
          .getBehavior(QUERY_BEHAVIOR)
          .pipe(take(1))
          .subscribe(query => {
            expect(query.firstName).toBe(null);
            expect(query.lastName).toBe(null);
            done();
          });
      });

      it('should have correct initial state for result', done => {
        store
          .getBehavior(RESULT_BEHAVIOR)
          .pipe(take(1))
          .subscribe(result => {
            expect(result.resultQuery).toBe(null);
            expect(Array.isArray(result.result)).toBe(true);
            expect(result.result.length).toBe(0);
            done();
          });
      });

      it('should automatically perform result effect', done => {
        store
          .getBehavior(RESULT_BEHAVIOR)
          .pipe(skip(1), take(1))
          .subscribe(result => {
            expect(result.resultQuery).not.toBe(null);
            expect(result.resultQuery?.firstName).toBe(null);
            expect(result.resultQuery?.lastName).toBe(null);
            expect(Array.isArray(result.result)).toBe(true);
            expect(result.result.length).toBe(3);
            done();
          });
      });

      it('should reduce the query', done => {
        const expected = 'test';
        store
          .getBehavior(QUERY_BEHAVIOR)
          .pipe(skip(1), take(1))
          .subscribe(query => {
            expect(query.firstName).toBe(null);
            expect(query.lastName).toBe(expected);
            done();
          });
        store.dispatchEvent(QUERY_EVENT, {
          lastName: expected,
        });
      });

      it('should get results for the reduced query', done => {
        const expected = 'test';
        store
          .getBehavior(RESULT_BEHAVIOR)
          .pipe(skip(2), take(1))
          .subscribe(result => {
            expect(result.resultQuery).not.toBe(null);
            expect(result.resultQuery?.firstName).toBe(null);
            expect(result.resultQuery?.lastName).toBe(expected);
            expect(Array.isArray(result.result)).toBe(true);
            expect(result.result.length).toBe(3);
            done();
          });
        store.dispatchEvent(QUERY_EVENT, {
          lastName: expected,
        });
      });

      it('should get initial query state after reset', async done => {
        store
          .getBehavior(QUERY_BEHAVIOR)
          .pipe(skip(2), take(1))
          .subscribe(query => {
            expect(query.firstName).toBe(null);
            expect(query.lastName).toBe(null);
            done();
          });
        await store.dispatchEvent(QUERY_EVENT, {
          lastName: 'test',
        });
        setTimeout(() => {
          // we should reset after timeout, because the effect dispatches events async
          // (so in theory, we would have to await the effects dispatch here)
          store.resetBehaviors();
        }, 10);
      });

      it('should get initial results state after reset', async done => {
        const expected = 'test';
        store
          .getBehavior(RESULT_BEHAVIOR)
          .pipe(skip(3), take(1))
          .subscribe(result => {
            expect(result.resultQuery).toBe(null);
            expect(Array.isArray(result.result)).toBe(true);
            expect(result.result.length).toBe(0);
            done();
          });
        await store.dispatchEvent(QUERY_EVENT, {
          lastName: expected,
        });
        setTimeout(() => {
          // we should reset after timeout, because the effect dispatches events async
          // (so in theory, we would have to await the effects dispatch here)
          store.resetBehaviors();
        }, 10);
      });

      it('should automatically perform result effect after reset', async done => {
        store
          .getBehavior(RESULT_BEHAVIOR)
          .pipe(skip(4), take(1))
          .subscribe(result => {
            expect(result.resultQuery).not.toBe(null);
            expect(result.resultQuery?.firstName).toBe(null);
            expect(result.resultQuery?.lastName).toBe(null);
            expect(Array.isArray(result.result)).toBe(true);
            expect(result.result.length).toBe(3);
            done();
          });
        await store.dispatchEvent(QUERY_EVENT, {
          lastName: 'test',
        });
        setTimeout(() => {
          // we should reset after timeout, because the effect dispatches events async
          // (so in theory, we would have to await the effects dispatch here)
          store.resetBehaviors();
        }, 10);
      });

      it('should give the reduced query, if subscribed after reducing', async done => {
        const expected = 'test';
        await store.dispatchEvent(QUERY_EVENT, {
          lastName: expected,
        });
        store
          .getBehavior(QUERY_BEHAVIOR)
          .pipe(take(1))
          .subscribe(query => {
            expect(query.firstName).toBe(null);
            expect(query.lastName).toBe(expected);
            done();
          });
      });
    });

    describe('cyclic dependencies', () => {
      const TEST_BEHAVIOR1: TypeIdentifier<number> = { symbol: Symbol('TEST_BEHAVIOR1') };
      const TEST_BEHAVIOR2: TypeIdentifier<number> = { symbol: Symbol('TEST_BEHAVIOR2') };
      const TEST_EVENT: TypeIdentifier<number> = { symbol: Symbol('TEST_EVENT') };

      beforeEach(() => {
        store.addStatelessBehavior(
          TEST_BEHAVIOR1,
          store
            .getEventStream(TEST_EVENT)
            .pipe(
              // tap((val) => console.log('TE-pipe: ', val)),
              withLatestFrom(
                store.getBehavior(TEST_BEHAVIOR2).pipe(
                  // tap((val) => console.log('TB2-pipe: ', val)),
                  map(val => val * 10),
                ),
              ),
            )
            .pipe(
              // tap((val) => console.log('pair-pipe: ', val)),
              map(pair => pair[0] * pair[1]),
            ),
          1,
        );

        store.addStatelessBehavior(
          TEST_BEHAVIOR2,
          store.getBehavior(TEST_BEHAVIOR1).pipe(map(val => val * 10)),
        );
      });

      it('should have correct initial value', done => {
        store
          .getBehavior(TEST_BEHAVIOR2)
          .pipe(take(1))
          .subscribe(val => {
            expect(val).toBe(10);
            done();
          });
      });

      it('should get correct value on first dispatch', done => {
        store
          .getBehavior(TEST_BEHAVIOR2)
          .pipe(skip(1), take(1))
          .subscribe(val => {
            expect(val).toBe(1000);
            done();
          });
        store.dispatchEvent(TEST_EVENT, 1);
      });

      it('should not change, if second event sent while unsubscribed', async done => {
        const subscription = store.getBehavior(TEST_BEHAVIOR2).subscribe();
        // console.log('sending event: 1...');
        await store.dispatchEvent(TEST_EVENT, 1);
        // console.log('unsubscribe...');
        subscription.unsubscribe();
        // console.log('sending event: 2...');
        await store.dispatchEvent(TEST_EVENT, 2);
        // console.log('subscribing again...');
        store
          .getBehavior(TEST_BEHAVIOR2)
          .pipe(take(1))
          .subscribe(val => {
            expect(val).toBe(1000);
            done();
          });
      });

      it('should get correct value on dispatch after resubscribe', async done => {
        const subscription = store.getBehavior(TEST_BEHAVIOR2).subscribe();
        await store.dispatchEvent(TEST_EVENT, 1);
        subscription.unsubscribe();
        await store.dispatchEvent(TEST_EVENT, 2);
        store
          .getBehavior(TEST_BEHAVIOR2)
          .pipe(skip(1), take(1))
          .subscribe(val => {
            expect(val).toBe(300000);
            done();
          });
        store.dispatchEvent(TEST_EVENT, 3);
      });
    });
  });
});
