import { BehaviorSubject } from 'rxjs';
import { Store } from '../src/store';

describe('Store', () => {
  let store: Store;
  let stringBehavior: BehaviorSubject<string>;

  beforeEach(() => {
    store = new Store();
    stringBehavior = new BehaviorSubject<string>('INITIAL_VALUE');
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
});
