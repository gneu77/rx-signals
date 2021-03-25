import { NEVER, of } from 'rxjs';
import { Store, TypeIdentifier } from '../src/store';
import { expectSequence } from './test.utils';

describe('Store', () => {
  const testId: TypeIdentifier<number> = { symbol: Symbol('TestBehavior') };

  let store: Store;

  beforeEach(() => {
    store = new Store();
  });

  describe('addLazyBehavior', () => {
    it('should throw, if behavior with given identifier already has a source', () => {
      store.addLazyBehavior(testId, NEVER);
      expect(() => {
        store.addLazyBehavior(testId, NEVER);
      }).toThrowError(
        'A behavior or event source with the given identifier was already added with a source: Symbol(TestBehavior)',
      );
    });

    it('should subscribe its source lazily', async () => {
      expect(store.getNumberOfBehaviorSources(testId)).toBe(0);
      await expectSequence(store.getIsSubscribedObservable(testId), [false]);
      store.addLazyBehavior(testId, of(1));
      expect(store.getNumberOfBehaviorSources(testId)).toBe(1);
      const subscribeSequence = expectSequence(store.getIsSubscribedObservable(testId), [
        false,
        true,
        false,
      ]);
      await expectSequence(store.getBehavior(testId), [1]);
      await subscribeSequence;
    });
  });

  describe('addNonLazyBehavior', () => {
    it('should throw, if behavior with given identifier already has a source', () => {
      store.addNonLazyBehavior(testId, NEVER);
      expect(() => {
        store.addNonLazyBehavior(testId, NEVER);
      }).toThrowError(
        'A behavior or event source with the given identifier was already added with a source: Symbol(TestBehavior)',
      );
    });

    it('should always subscribe its source', async () => {
      expect(store.getNumberOfBehaviorSources(testId)).toBe(0);

      // no source -> nonLazy source -> completed source removed
      const subscribeSequence1 = expectSequence(store.getIsSubscribedObservable(testId), [
        false,
        true,
        false,
      ]);
      store.addNonLazyBehavior(testId, of(1));
      await subscribeSequence1;
      expect(store.getNumberOfBehaviorSources(testId)).toBe(0); // the source has already completed and was thus removed

      const subscribeSequence = expectSequence(store.getIsSubscribedObservable(testId), [
        false,
        true,
        false,
      ]);
      store.addNonLazyBehavior(testId, of(2)); // possible, because the original source has completed and was thus removed
      expect(store.getNumberOfBehaviorSources(testId)).toBe(0); // the source has already completed and was thus removed

      await expectSequence(store.getBehavior(testId), [2]); // we get the latest value, though the source of it has already completed
      await subscribeSequence;
    });
  });

  // describe('addNonLazyBehavior', () => {
  //   it('should throw, if behavior with given identifier already exists', () => {
  //     const id = { symbol: Symbol('TEST') };
  //     store.addNonLazyBehavior(id, stringBehavior.asObservable());
  //     expect(() => {
  //       store.addNonLazyBehavior(id, stringBehavior.asObservable());
  //     }).toThrowError(
  //       'A behavior or event source with the given identifier was already added with a source: Symbol(TEST)',
  //     );
  //   });

  //   it('should work', () => {
  //     expect(() => {
  //       store.addNonLazyBehavior({ symbol: Symbol('TEST') }, stringBehavior.asObservable());
  //     }).not.toThrow();
  //   });
  // });

  // describe('removeBehavior', () => {
  //   it('should work', () => {
  //     expect(() => {
  //       store.removeBehaviorSources({ symbol: Symbol('TEST') });
  //     }).not.toThrow();
  //   });
  // });

  // describe('getBehavior', () => {
  //   it('should work', () => {
  //     const behavior = store.getBehavior({ symbol: Symbol('TEST') });
  //     expect(typeof behavior.pipe).toBe('function');
  //   });
  // });
});
