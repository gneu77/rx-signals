import { map, tap, withLatestFrom } from 'rxjs/operators';
import { getDerivedId, getEventId, getStateId } from '../src/store-utils';
import { expectSequence } from '../src/test-utils/test-utils';
import { Store } from './../src/store';
describe('Behaviors share and reset logic', () => {
  const doubledBehavior = getDerivedId<number>();
  const tripledBehavior = getDerivedId<number>();

  const addToRootEvent = getEventId<number>();

  let store: Store;
  let doubledCalculated: number;
  let tripledCalculated: number;

  describe('with lazy root behavior', () => {
    const rootBehavior = getDerivedId<number>();

    beforeEach((): void => {
      store = new Store();
      doubledCalculated = 0;
      tripledCalculated = 0;

      store.addDerivedState(
        rootBehavior,
        store.getEventStream(addToRootEvent).pipe(
          withLatestFrom(store.getBehavior(rootBehavior)),
          map(([add, state]) => state + add),
        ),
        5,
      );
      store.addDerivedState(
        doubledBehavior,
        store.getBehavior(rootBehavior).pipe(
          map(root => root * 2),
          tap(() => {
            doubledCalculated = doubledCalculated + 1;
          }),
        ),
      );
      store.addDerivedState(
        tripledBehavior,
        store.getBehavior(rootBehavior).pipe(
          map(root => root * 3),
          tap(() => {
            tripledCalculated = tripledCalculated + 1;
          }),
        ),
      );
    });

    it('should yield the correct sequences for derived behaviors', async () => {
      await store.dispatch(addToRootEvent, 2); // there should not yet be any subscription listening

      const doubledSequence = expectSequence(store.getBehavior(doubledBehavior), [10, 14, 20]);
      await store.dispatch(addToRootEvent, 2); // now we have doubledBehavior listening

      const tripledSequence = expectSequence(store.getBehavior(tripledBehavior), [21, 30]);
      store.dispatch(addToRootEvent, 3);

      await doubledSequence;
      await tripledSequence;
    });

    it('should share behavior values', async () => {
      const doubledSequence1 = expectSequence(store.getBehavior(doubledBehavior), [10, 14]);
      const doubledSequence2 = expectSequence(store.getBehavior(doubledBehavior), [10, 14]);
      const doubledSequence3 = expectSequence(store.getBehavior(doubledBehavior), [10, 14]);

      store.dispatch(addToRootEvent, 2);

      await doubledSequence1;
      await doubledSequence2;
      await doubledSequence3;

      expect(doubledCalculated).toBe(2);
      expect(tripledCalculated).toBe(0);
    });

    it('should get the latest behavior values upon resubscription', async () => {
      const doubledSequence = expectSequence(store.getBehavior(doubledBehavior), [10, 14]);
      const tripledSequence1 = expectSequence(store.getBehavior(tripledBehavior), [15, 21, 30]);

      store.dispatch(addToRootEvent, 2);

      await doubledSequence;
      expect(doubledCalculated).toBe(2);

      const tripledSequence2 = expectSequence(store.getBehavior(tripledBehavior), [21, 30]);

      store.dispatch(addToRootEvent, 3); // at this point only tripledBehavior should be listening

      await tripledSequence1;
      await tripledSequence2;

      await expectSequence(store.getBehavior(doubledBehavior), [20]); // will re-calculate

      expect(doubledCalculated).toBe(3);
      expect(tripledCalculated).toBe(3);
    });

    it('should behave correctly upon reset while there are subscribers', async () => {
      const doubledSequence = expectSequence(store.getBehavior(doubledBehavior), [10, 14]);
      const tripledSequence1 = expectSequence(store.getBehavior(tripledBehavior), [15, 21, 30, 15]);

      store.dispatch(addToRootEvent, 2);

      await doubledSequence;
      expect(doubledCalculated).toBe(2);

      const tripledSequence2 = expectSequence(store.getBehavior(tripledBehavior), [21, 30, 15]);

      await store.dispatch(addToRootEvent, 3);

      expect(store.isSubscribed(doubledBehavior)).toBe(false);
      expect(store.isSubscribed(tripledBehavior)).toBe(true);
      expect(store.isSubscribed(rootBehavior)).toBe(true);
      store.resetBehaviors();

      await tripledSequence1;
      await tripledSequence2;

      await expectSequence(store.getBehavior(doubledBehavior), [10]);

      expect(doubledCalculated).toBe(3);
      expect(tripledCalculated).toBe(4);
    });

    it('should behave correctly upon reset while there are no subscribers', async () => {
      const doubledSequence = expectSequence(store.getBehavior(doubledBehavior), [10, 14]);
      const tripledSequence = expectSequence(store.getBehavior(tripledBehavior), [15, 21, 30]);

      store.dispatch(addToRootEvent, 2);

      await doubledSequence;

      store.dispatch(addToRootEvent, 3);
      await tripledSequence;

      await expectSequence(store.getBehavior(doubledBehavior), [20]);
      await expectSequence(store.getBehavior(tripledBehavior), [30]);

      expect(store.isSubscribed(doubledBehavior)).toBe(false);
      expect(store.isSubscribed(tripledBehavior)).toBe(false);
      expect(store.isSubscribed(rootBehavior)).toBe(false);
      store.resetBehaviors();

      await expectSequence(store.getBehavior(doubledBehavior), [10]);
      await expectSequence(store.getBehavior(tripledBehavior), [15]);

      expect(store.isSubscribed(doubledBehavior)).toBe(false);
      expect(store.isSubscribed(tripledBehavior)).toBe(false);
      expect(store.isSubscribed(rootBehavior)).toBe(false);

      await store.dispatch(addToRootEvent, 2); // should have no listener
      await expectSequence(store.getBehavior(doubledBehavior), [10]);
      await expectSequence(store.getBehavior(tripledBehavior), [15]);
    });
  });

  describe('with not-lazy root behavior', () => {
    const rootBehavior = getStateId<number>();

    beforeEach((): void => {
      store = new Store();
      doubledCalculated = 0;
      tripledCalculated = 0;

      store.addState(rootBehavior, 5);
      store.addReducer(rootBehavior, addToRootEvent, (state, event) => state + event);
      store.addDerivedState(
        doubledBehavior,
        store.getBehavior(rootBehavior).pipe(
          map(root => root * 2),
          tap(() => {
            doubledCalculated = doubledCalculated + 1;
          }),
        ),
      );
      store.addDerivedState(
        tripledBehavior,
        store.getBehavior(rootBehavior).pipe(
          map(root => root * 3),
          tap(() => {
            tripledCalculated = tripledCalculated + 1;
          }),
        ),
      );
    });

    it('should get the latest behavior values upon resubscription', async () => {
      const doubledSequence = expectSequence(store.getBehavior(doubledBehavior), [10, 14]);
      const tripledSequence1 = expectSequence(store.getBehavior(tripledBehavior), [15, 21, 30]);

      store.dispatch(addToRootEvent, 2);

      await doubledSequence;
      expect(doubledCalculated).toBe(2);

      const tripledSequence2 = expectSequence(store.getBehavior(tripledBehavior), [21, 30]);

      store.dispatch(addToRootEvent, 3); // at this point only tripledBehavior should be listening

      await tripledSequence1;
      await tripledSequence2;

      await expectSequence(store.getBehavior(doubledBehavior), [20]); // will re-calculate

      expect(doubledCalculated).toBe(3);
      expect(tripledCalculated).toBe(3);
    });

    it('should behave correctly upon reset while there are subscribers', async () => {
      const doubledSequence = expectSequence(store.getBehavior(doubledBehavior), [10, 14]);
      const tripledSequence1 = expectSequence(store.getBehavior(tripledBehavior), [15, 21, 30, 15]);

      store.dispatch(addToRootEvent, 2);

      await doubledSequence;
      expect(doubledCalculated).toBe(2);

      const tripledSequence2 = expectSequence(store.getBehavior(tripledBehavior), [21, 30, 15]);

      await store.dispatch(addToRootEvent, 3);

      expect(store.isSubscribed(doubledBehavior)).toBe(false);
      expect(store.isSubscribed(tripledBehavior)).toBe(true);
      expect(store.isSubscribed(rootBehavior)).toBe(true);
      store.resetBehaviors();

      await tripledSequence1;
      await tripledSequence2;

      await expectSequence(store.getBehavior(doubledBehavior), [10]);

      expect(doubledCalculated).toBe(3);
      expect(tripledCalculated).toBe(4);
    });

    it('should behave correctly upon reset while there are no subscribers', async () => {
      const doubledSequence = expectSequence(store.getBehavior(doubledBehavior), [10, 14]);
      const tripledSequence = expectSequence(store.getBehavior(tripledBehavior), [15, 21, 30]);

      store.dispatch(addToRootEvent, 2);

      await doubledSequence;

      store.dispatch(addToRootEvent, 3);
      await tripledSequence;

      await expectSequence(store.getBehavior(doubledBehavior), [20]);
      await expectSequence(store.getBehavior(tripledBehavior), [30]);

      expect(store.isSubscribed(doubledBehavior)).toBe(false);
      expect(store.isSubscribed(tripledBehavior)).toBe(false);
      expect(store.isSubscribed(rootBehavior)).toBe(true); // difference to lazy root
      store.resetBehaviors();

      await expectSequence(store.getBehavior(doubledBehavior), [10]);
      await expectSequence(store.getBehavior(tripledBehavior), [15]);

      expect(store.isSubscribed(doubledBehavior)).toBe(false);
      expect(store.isSubscribed(tripledBehavior)).toBe(false);
      expect(store.isSubscribed(rootBehavior)).toBe(true); // difference to lazy root

      await store.dispatch(addToRootEvent, 2); // root should be reduced: difference to lazy root
      await expectSequence(store.getBehavior(doubledBehavior), [14]);
      await expectSequence(store.getBehavior(tripledBehavior), [21]);
    });
  });
});
