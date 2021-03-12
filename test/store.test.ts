import { BehaviorSubject, Subject } from 'rxjs';
import { map, skip, take, withLatestFrom } from 'rxjs/operators';
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
