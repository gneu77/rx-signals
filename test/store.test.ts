import { BehaviorSubject, Subject } from 'rxjs';
import { Store } from '../src/store';

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
});
