import { BehaviorSubject, combineLatest, Observable, of, Subject } from 'rxjs';
import { debounceTime, filter, startWith, switchMap, take } from 'rxjs/operators';
import { Store, TypeIdentifier } from './store';

describe('Store', () => {
  let store: Store;
  let stringBehavior: BehaviorSubject<string>;
  let stringEventSource: Subject<string>;

  beforeEach(() => {
    store = new Store();
    stringBehavior = new BehaviorSubject<string>('INITIAL_VALUE');
    stringEventSource = new Subject<string>();
  });

  describe('addBehavior', () => {
    it('should throw, if no valid identifier', () => {
      expect(() => {
        store.addBehavior((undefined as unknown) as TypeIdentifier<string>, stringBehavior.asObservable());
      }).toThrowError('identifier.symbol is mandatory');
      expect(() => {
        store.addBehavior(({ symbol: null } as unknown) as TypeIdentifier<string>, stringBehavior.asObservable());
      }).toThrowError('identifier.symbol is mandatory');
    });

    it('should throw, if no valid observable', () => {
      expect(() => {
        store.addBehavior({ symbol: Symbol('TEST') }, (null as unknown) as Observable<any>);
      }).toThrowError('observable is mandatory');
    });

    it('should throw, if behavior with given identifier already exists', () => {
      const id = { symbol: Symbol('TEST') };
      store.addBehavior(id, stringBehavior.asObservable());
      expect(() => {
        store.addBehavior(id, stringBehavior.asObservable());
      }).toThrowError('A behavior or event source with the given identifier was already added: Symbol(TEST)');
    });

    it('should throw, if event source with given identifier already exists', () => {
      const id = { symbol: Symbol('TEST') };
      store.addEventSource(id, stringEventSource.asObservable());
      expect(() => {
        store.addBehavior(id, stringBehavior.asObservable());
      }).toThrowError('A behavior or event source with the given identifier was already added: Symbol(TEST)');
    });

    it('should work', () => {
      expect(() => {
        store.addBehavior({ symbol: Symbol('TEST') }, stringBehavior.asObservable());
      }).not.toThrow();
    });
  });

  describe('removeBehavior', () => {
    it('should throw, if no valid identifier', () => {
      expect(() => {
        store.removeBehavior((undefined as unknown) as TypeIdentifier<string>);
      }).toThrowError('identifier.symbol is mandatory');
      expect(() => {
        store.removeBehavior(({ symbol: null } as unknown) as TypeIdentifier<string>);
      }).toThrowError('identifier.symbol is mandatory');
    });

    it('should work', () => {
      expect(() => {
        store.removeBehavior({ symbol: Symbol('TEST') });
      }).not.toThrow();
    });
  });

  describe('getBehavior', () => {
    it('should throw, if no valid identifier', () => {
      expect(() => {
        store.getBehavior((undefined as unknown) as TypeIdentifier<string>);
      }).toThrowError('identifier.symbol is mandatory');
      expect(() => {
        store.getBehavior(({ symbol: null } as unknown) as TypeIdentifier<string>);
      }).toThrowError('identifier.symbol is mandatory');
    });

    it('should work', () => {
      const behavior = store.getBehavior({ symbol: Symbol('TEST') });
      expect(typeof behavior.pipe).toBe('function');
    });
  });

  describe('getEventStream', () => {
    it('should throw, if no valid identifier', () => {
      expect(() => {
        store.getEventStream((undefined as unknown) as TypeIdentifier<string>);
      }).toThrowError('identifier.symbol is mandatory');
      expect(() => {
        store.getEventStream(({ symbol: null } as unknown) as TypeIdentifier<string>);
      }).toThrowError('identifier.symbol is mandatory');
    });

    it('should work', () => {
      const eventStream = store.getEventStream({ symbol: Symbol('TEST') });
      expect(typeof eventStream.pipe).toBe('function');
    });
  });

  describe('dispatchEvent', () => {
    it('should throw, if no valid identifier', () => {
      expect(() => {
        store.dispatchEvent((undefined as unknown) as TypeIdentifier<string>, 'test');
      }).toThrowError('identifier.symbol is mandatory');
      expect(() => {
        store.dispatchEvent(({ symbol: null } as unknown) as TypeIdentifier<string>, 'test');
      }).toThrowError('identifier.symbol is mandatory');
    });

    it('should work', () => {
      expect(() => {
        store.dispatchEvent({ symbol: Symbol('TEST') }, 'test');
      }).not.toThrow();
    });
  });

  describe('addEventSource', () => {
    it('should throw, if no valid identifier', () => {
      expect(() => {
        store.addEventSource((undefined as unknown) as TypeIdentifier<string>, stringEventSource.asObservable());
      }).toThrowError('identifier.symbol is mandatory');
      expect(() => {
        store.addEventSource(({ symbol: null } as unknown) as TypeIdentifier<string>, stringEventSource.asObservable());
      }).toThrowError('identifier.symbol is mandatory');
    });

    it('should throw, if no valid observable', () => {
      expect(() => {
        store.addEventSource({ symbol: Symbol('TEST') }, (null as unknown) as Observable<any>);
      }).toThrowError('observable is mandatory');
    });

    it('should throw, if behavior with given identifier already exists', () => {
      const id = { symbol: Symbol('TEST') };
      store.addBehavior(id, stringBehavior.asObservable());
      expect(() => {
        store.addEventSource(id, stringEventSource.asObservable());
      }).toThrowError('A behavior or event source with the given identifier was already added: Symbol(TEST)');
    });

    it('should throw, if event source with given identifier already exists', () => {
      const id = { symbol: Symbol('TEST') };
      store.addEventSource(id, stringEventSource.asObservable());
      expect(() => {
        store.addEventSource(id, stringEventSource.asObservable());
      }).toThrowError('A behavior or event source with the given identifier was already added: Symbol(TEST)');
    });

    it('should work', () => {
      expect(() => {
        store.addEventSource({ symbol: Symbol('TEST') }, stringEventSource.asObservable());
      }).not.toThrow();
    });
  });

  describe('removeEventSource', () => {
    it('should throw, if no valid identifier', () => {
      expect(() => {
        store.removeEventSource((undefined as unknown) as TypeIdentifier<string>);
      }).toThrowError('identifier.symbol is mandatory');
      expect(() => {
        store.removeEventSource(({ symbol: null } as unknown) as TypeIdentifier<string>);
      }).toThrowError('identifier.symbol is mandatory');
    });

    it('should work', () => {
      expect(() => {
        store.removeEventSource({ symbol: Symbol('TEST') });
      }).not.toThrow();
    });
  });

  describe('complex', () => {
    it('should receive dispatched events', (done) => {
      const identifier: TypeIdentifier<string> = {
        symbol: Symbol('TEST'),
      };
      store.getEventStream(identifier).subscribe((val) => {
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
        store.addBehavior(QUERY_BEHAVIOR, store.getEventStream(QUERY_EVENT).pipe(startWith(null)));
      });

      describe('lazy behaviors and effects: adding result behavior', () => {
        beforeEach(() => {
          store.addBehavior(
            RESULT_BEHAVIOR,
            store.getEventStream(RESULT_EVENT).pipe(startWith({ result: [], resultQuery: null })),
          );
        });

        describe('lazy behaviors and effects: adding query effect as event source', () => {
          beforeEach(() => {
            const eventSource = combineLatest([
              store.getBehavior(QUERY_BEHAVIOR),
              store.getBehavior(RESULT_BEHAVIOR),
            ]).pipe(
              filter((pair) => pair[0] !== pair[1].resultQuery),
              debounceTime(150),
              switchMap((pair) => of({ result: [1, 2, 3], resultQuery: pair[0] })),
            );
            store.addEventSource(RESULT_EVENT, eventSource);
          });

          it('should have a current value for the result behavior', (done) => {
            store
              .getBehavior(RESULT_BEHAVIOR)
              .pipe(take(1))
              .subscribe((result) => {
                expect(result.resultQuery).toBe(null);
                expect(Array.isArray(result.result)).toBe(true);
                expect(result.result.length).toBe(0);
                done();
              });
          });
        });
      });
    });
  });
});
