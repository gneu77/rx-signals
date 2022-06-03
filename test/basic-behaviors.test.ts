import { interval, NEVER, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { Store } from '../src/store';
import { getDerivedId, getStateId } from '../src/store-utils';
import { awaitCompletion, awaitError, expectSequence } from '../src/test-utils/test-utils';

describe('Behavior basics', () => {
  let store: Store;

  beforeEach(() => {
    store = new Store();
  });

  describe('addLazyBehavior', () => {
    const testId = getDerivedId<number>();

    it('should throw, if behavior with given identifier already has a source', () => {
      store.addDerivedState(testId, NEVER);
      expect(() => {
        store.addDerivedState(testId, NEVER);
      }).toThrowError(
        'A behavior or event source with the given identifier has already been added: Symbol(D_1)',
      );
    });
    it('should be possible to add behavior sources again, after initial source has completed', async () => {
      const isSubscribedSequence = expectSequence(store.getIsSubscribedObservable(testId), [
        false,
        true,
        false,
      ]);
      store.addDerivedState(testId, of(1));
      expect(store.isSubscribed(testId)).toBe(false);
      const sequence = expectSequence(store.getBehavior(testId), [1, 2]);
      expect(store.isSubscribed(testId)).toBe(true);
      store.addDerivedState(testId, of(2));
      await sequence;
      await isSubscribedSequence;
    });

    it('should subscribe its source lazily', async () => {
      expect(store.getNumberOfBehaviorSources(testId)).toBe(0);
      await expectSequence(store.getIsSubscribedObservable(testId), [false]);
      store.addDerivedState(testId, of(1));
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
    const testId = getStateId<number>();

    it('should throw, if behavior with given identifier already has a source', () => {
      store.addState(testId, 42);
      expect(() => {
        store.addState(testId, 42);
      }).toThrowError(
        'A behavior or event source with the given identifier has already been added: Symbol(S_1)',
      );
    });

    it('should always subscribe its source', async () => {
      expect(store.getNumberOfBehaviorSources(testId)).toBe(0);

      // no source -> nonLazy source
      const subscribeSequence1 = expectSequence(store.getIsSubscribedObservable(testId), [
        false,
        true,
      ]);
      store.addState(testId, 1);
      await subscribeSequence1;
    });
  });

  describe('removeBehaviorSources', () => {
    const testId = getDerivedId<number>();

    it('should work without completing target subscriptions', async () => {
      store.addDerivedState(testId, NEVER);
      const sequence = expectSequence(store.getBehavior(testId), [1, 2]);
      expect(store.getNumberOfBehaviorSources(testId)).toBe(1);
      store.removeBehaviorSources(testId);
      expect(store.getNumberOfBehaviorSources(testId)).toBe(0);
      store.addDerivedState(testId, of(1, 2));
      await sequence;
    });

    it('should propagate source errors and still work after re-subscribe', async () => {
      store.addDerivedState(
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
    const testId = getDerivedId<number>();

    it('should remove all sources, and complete the target', async () => {
      store.addDerivedState(
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
