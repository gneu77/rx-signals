import { interval, NEVER, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { Store } from '../src/store';
import { getBehaviorId } from '../src/store-utils';
import { awaitCompletion, awaitError, expectSequence } from './test.utils';

describe('Behavior basics', () => {
  const testId = getBehaviorId<number>();

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
        'A behavior or event source with the given identifier was already added with a source: Symbol(b_)',
      );
    });
    it('should be possible to add behavior sources again, after initial source has completed', async () => {
      const isSubscribedSequence = expectSequence(store.getIsSubscribedObservable(testId), [
        false,
        true,
        false,
      ]);
      store.addLazyBehavior(testId, of(1));
      expect(store.isSubscribed(testId)).toBe(false);
      const sequence = expectSequence(store.getBehavior(testId), [1, 2]);
      expect(store.isSubscribed(testId)).toBe(true);
      store.addLazyBehavior(testId, of(2));
      await sequence;
      await isSubscribedSequence;
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
        'A behavior or event source with the given identifier was already added with a source: Symbol(b_)',
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

  describe('removeBehaviorSources', () => {
    it('should work without completing target subscriptions', async () => {
      store.addLazyBehavior(testId, NEVER);
      const sequence = expectSequence(store.getBehavior(testId), [1, 2]);
      expect(store.getNumberOfBehaviorSources(testId)).toBe(1);
      store.removeBehaviorSources(testId);
      expect(store.getNumberOfBehaviorSources(testId)).toBe(0);
      store.addLazyBehavior(testId, of(1, 2));
      await sequence;
    });

    it('should propagate source errors and still work after re-subscribe', async () => {
      store.addLazyBehavior(
        testId,
        interval(10).pipe(
          map(val => {
            if (val === 3) {
              throw 'ERROR';
            }
            return val;
          }),
        ),
      );
      await awaitError(store.getBehavior(testId));
      expect(store.getNumberOfBehaviorSources(testId)).toBe(1);
      await expectSequence(store.getBehavior(testId), [0, 1]); // not starting with 2 due to error in pre-subscribe
    });
  });

  describe('completeBehavior', () => {
    it('should remove all sources, and complete the target', async () => {
      store.addLazyBehavior(
        testId,
        interval(10).pipe(
          tap(s => {
            if (s === 3) {
              store.completeBehavior(testId);
            }
          }),
        ),
      );

      await expectSequence(store.getBehavior(testId), [0, 1, 2]);
      expect(store.getNumberOfBehaviorSources(testId)).toBe(1);

      await expectSequence(store.getBehavior(testId), [2, 0, 1, 2]);
      await awaitCompletion(store.getBehavior(testId));
      expect(store.getNumberOfBehaviorSources(testId)).toBe(0);
    });
  });
});
