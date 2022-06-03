import { of } from 'rxjs';
import { filter, map, mapTo, switchMap, take, tap } from 'rxjs/operators';
import { Store } from '../src/store';
import { getEventId, getStateId } from '../src/store-utils';
import { expectSequence } from '../src/test-utils/test-utils';

describe('Event order', () => {
  const counterState = getStateId<number>();
  const addEvent = getEventId<number>();
  const multiplyEvent = getEventId<number>();

  let store: Store;

  beforeEach(() => {
    store = new Store();

    store.addState(counterState, 0);
    store.addReducer(counterState, addEvent, (s, e) => s + e);
    store.addReducer(counterState, multiplyEvent, (s, e) => s * e);

    store.addEventSource(
      addEvent,
      store.getBehavior(counterState).pipe(
        filter(counter => counter === 9),
        switchMap(() => of(1)),
      ),
    );
  });

  it('should preserve the order in which events are dispatched 1', async () => {
    const counterSequence = expectSequence(store.getBehavior(counterState), [0, 3, 9, 18, 19]);

    // as we do not await the dispatches, the last multiply is dispatched before the dispatch in the effect (add 1) is dispatched
    store.dispatch(addEvent, 3); // => 3
    store.dispatch(multiplyEvent, 3); // => 9
    store.dispatch(multiplyEvent, 2); // => 18

    await counterSequence;
  });

  it('should preserve the order in which events are dispatched 2', async () => {
    const counterSequence = expectSequence(store.getBehavior(counterState), [0, 3, 9, 10, 20]);

    // now we await the *3 dispatch and thus, the +1 dispatch from the effect comes before the *2 dispatch
    store.dispatch(addEvent, 3); // => 3
    await store.dispatch(multiplyEvent, 3); // => 9 => 10
    store.dispatch(multiplyEvent, 2); // => 20

    await counterSequence;
  });

  describe('examples from documentation', () => {
    it('should work as described in the first example of the documentation', async () => {
      const myEvent = getEventId<number>();
      const values: number[] = [];
      const sequence = expectSequence(
        store.getEventStream(myEvent).pipe(tap(v => values.push(v))),
        [3, 4, 5, 6, 7],
      );

      store.addEventSource(
        myEvent,
        store.getEventStream(myEvent).pipe(
          filter(v => v === 3),
          mapTo(7),
        ),
      );
      store.addEventSource(myEvent, of(3, 4, 5));
      values.push(1);
      store.dispatch(myEvent, 6);
      values.push(2);

      await sequence;
      expect(values).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it('should work as described in the second example of the documentation', async () => {
      const myEvent = getEventId<number>();
      const sequence = expectSequence(
        store.getEventStream(myEvent).pipe(take(14)),
        [1, 2, 6, 21, 7, 22, 11, 26, 26, 41, 12, 27, 27, 42],
      );

      store.addEventSource(
        myEvent,
        store.getEventStream(myEvent).pipe(
          map(e => e + 5), // 6, 7 -> 11, 26, 12, 27
        ),
      );
      store.addEventSource(
        myEvent,
        store.getEventStream(myEvent).pipe(
          map(e => e + 20), // 21, 22 -> 26, 41, 27, 42
        ),
      );
      store.dispatch(myEvent, 1);
      store.dispatch(myEvent, 2);

      await sequence;
    });
  });
});
