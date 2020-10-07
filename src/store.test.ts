import { BehaviorSubject, Observable, Subject } from 'rxjs';
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
  });
});
