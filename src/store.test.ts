import { BehaviorSubject, combineLatest, Observable, of, Subject } from 'rxjs';
import { debounceTime, filter, scan, switchMap, take } from 'rxjs/operators';
import { Store, TypeIdentifier } from './store';

describe('Store', () => {
  let store: Store;
  let stringBehavior: BehaviorSubject<string>;
  let numberStatefulBehaviorSource: Subject<number>;
  let numberStatefulBehavior: Observable<number>;
  let stringEventSource: Subject<string>;

  beforeEach(() => {
    store = new Store();
    stringBehavior = new BehaviorSubject<string>('INITIAL_VALUE');
    numberStatefulBehaviorSource = new Subject<number>();
    numberStatefulBehavior = numberStatefulBehaviorSource.pipe(scan((prev, next) => prev + next, 0));
    stringEventSource = new Subject<string>();
  });

  describe('addStatelessBehavior', () => {
    it('should throw, if no valid identifier', () => {
      expect(() => {
        store.addStatelessBehavior((undefined as unknown) as TypeIdentifier<string>, stringBehavior.asObservable());
      }).toThrowError('identifier.symbol is mandatory');
      expect(() => {
        store.addStatelessBehavior(
          ({ symbol: null } as unknown) as TypeIdentifier<string>,
          stringBehavior.asObservable(),
        );
      }).toThrowError('identifier.symbol is mandatory');
    });

    it('should throw, if no valid observable', () => {
      expect(() => {
        store.addStatelessBehavior({ symbol: Symbol('TEST') }, (null as unknown) as Observable<any>);
      }).toThrowError('observable is mandatory');
    });

    it('should throw, if behavior with given identifier already exists', () => {
      const id = { symbol: Symbol('TEST') };
      store.addStatelessBehavior(id, stringBehavior.asObservable());
      expect(() => {
        store.addStatelessBehavior(id, stringBehavior.asObservable());
      }).toThrowError(
        'A behavior or event source with the given identifier was already added with a source: Symbol(TEST)',
      );
    });

    it('should throw, if event source with given identifier already exists', () => {
      const id = { symbol: Symbol('TEST') };
      store.addEventSource(id, stringEventSource.asObservable());
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
    it('should throw, if no valid identifier', () => {
      expect(() => {
        store.addStatefulBehavior((undefined as unknown) as TypeIdentifier<number>, numberStatefulBehavior);
      }).toThrowError('identifier.symbol is mandatory');
      expect(() => {
        store.addStatefulBehavior(
          ({ symbol: null } as unknown) as TypeIdentifier<string>,
          stringBehavior.asObservable(),
        );
      }).toThrowError('identifier.symbol is mandatory');
    });

    it('should throw, if no valid observable', () => {
      expect(() => {
        store.addStatefulBehavior({ symbol: Symbol('TEST') }, (null as unknown) as Observable<any>);
      }).toThrowError('observable is mandatory');
    });

    it('should throw, if behavior with given identifier already exists', () => {
      const id = { symbol: Symbol('TEST') };
      store.addStatefulBehavior(id, stringBehavior.asObservable());
      expect(() => {
        store.addStatefulBehavior(id, stringBehavior.asObservable());
      }).toThrowError(
        'A behavior or event source with the given identifier was already added with a source: Symbol(TEST)',
      );
    });

    it('should throw, if event source with given identifier already exists', () => {
      const id = { symbol: Symbol('TEST') };
      store.addEventSource(id, stringEventSource.asObservable());
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
      store.addStatelessBehavior(id, stringBehavior.asObservable());
      expect(() => {
        store.addEventSource(id, stringEventSource.asObservable());
      }).toThrowError(
        'A behavior or event source with the given identifier was already added with a source: Symbol(TEST)',
      );
    });

    it('should throw, if event source with given identifier already exists', () => {
      const id = { symbol: Symbol('TEST') };
      store.addEventSource(id, stringEventSource.asObservable());
      expect(() => {
        store.addEventSource(id, stringEventSource.asObservable());
      }).toThrowError(
        'A behavior or event source with the given identifier was already added with a source: Symbol(TEST)',
      );
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
