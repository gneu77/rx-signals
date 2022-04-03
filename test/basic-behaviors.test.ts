import { interval, NEVER, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { Store } from '../src/store';
import { getBehaviorId } from '../src/store-utils';
import { awaitCompletion, awaitError, expectSequence } from '../src/test-utils/test-utils';

describe('Behavior basics', () => {
  const testId = getBehaviorId<number>();

  let store: Store;

  beforeEach(() => {
    store = new Store();
  });

  describe('addLazyBehavior', () => {
    it('should throw, if behavior with given identifier already has a source', () => {
      store.addBehavior(testId, NEVER, true);
      expect(() => {
        store.addBehavior(testId, NEVER, true);
      }).toThrowError(
        'A behavior or event source with the given identifier has already been added: Symbol(B_1)',
      );
    });
    it('should be possible to add behavior sources again, after initial source has completed', async () => {
      const isSubscribedSequence = expectSequence(store.getIsSubscribedObservable(testId), [
        false,
        true,
        false,
      ]);
      store.addBehavior(testId, of(1), true);
      expect(store.isSubscribed(testId)).toBe(false);
      const sequence = expectSequence(store.getBehavior(testId), [1, 2]);
      expect(store.isSubscribed(testId)).toBe(true);
      store.addBehavior(testId, of(2), true);
      await sequence;
      await isSubscribedSequence;
    });

    it('should subscribe its source lazily', async () => {
      expect(store.getNumberOfBehaviorSources(testId)).toBe(0);
      await expectSequence(store.getIsSubscribedObservable(testId), [false]);
      store.addBehavior(testId, of(1), true);
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
      store.addBehavior(testId, NEVER, false);
      expect(() => {
        store.addBehavior(testId, NEVER, false);
      }).toThrowError(
        'A behavior or event source with the given identifier has already been added: Symbol(B_1)',
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
      store.addBehavior(testId, of(1), false);
      await subscribeSequence1;
      expect(store.getNumberOfBehaviorSources(testId)).toBe(0); // the source has already completed and was thus removed

      const subscribeSequence = expectSequence(store.getIsSubscribedObservable(testId), [
        false,
        true,
        false,
      ]);
      store.addBehavior(testId, of(2), false); // possible, because the original source has completed and was thus removed
      expect(store.getNumberOfBehaviorSources(testId)).toBe(0); // the source has already completed and was thus removed

      await expectSequence(store.getBehavior(testId), [2]); // we get the latest value, though the source of it has already completed
      await subscribeSequence;
    });
  });

  describe('removeBehaviorSources', () => {
    it('should work without completing target subscriptions', async () => {
      store.addBehavior(testId, NEVER, true);
      const sequence = expectSequence(store.getBehavior(testId), [1, 2]);
      expect(store.getNumberOfBehaviorSources(testId)).toBe(1);
      store.removeBehaviorSources(testId);
      expect(store.getNumberOfBehaviorSources(testId)).toBe(0);
      store.addBehavior(testId, of(1, 2), true);
      await sequence;
    });

    it('should propagate source errors and still work after re-subscribe', async () => {
      store.addBehavior(
        testId,
        interval(10).pipe(
          map(val => {
            if (val === 3) {
              throw 'ERROR';
            }
            return val;
          }),
        ),
        true,
      );
      await awaitError(store.getBehavior(testId));
      expect(store.getNumberOfBehaviorSources(testId)).toBe(1);
      await expectSequence(store.getBehavior(testId), [0, 1]); // not starting with 2 due to error in pre-subscribe
    });
  });

  describe('completeBehavior', () => {
    it('should remove all sources, and complete the target', async () => {
      store.addBehavior(
        testId,
        interval(10).pipe(
          tap(s => {
            if (s === 3) {
              store.completeBehavior(testId);
            }
          }),
        ),
        true,
      );

      await expectSequence(store.getBehavior(testId), [0, 1, 2]);
      expect(store.getNumberOfBehaviorSources(testId)).toBe(1);

      await expectSequence(store.getBehavior(testId), [2, 0, 1, 2]);
      await awaitCompletion(store.getBehavior(testId));
      expect(store.getNumberOfBehaviorSources(testId)).toBe(0);
    });
  });
});
