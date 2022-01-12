import { merge, of } from 'rxjs';
import { filter, map, mapTo, switchMap, take, tap, withLatestFrom } from 'rxjs/operators';
import { Store } from '../src/store';
import { getIdentifier } from '../src/store.utils';
import { expectSequence } from './test.utils';

describe('Event order', () => {
  const counterState = getIdentifier<number>();
  const addEvent = getIdentifier<number>();
  const multiplyEvent = getIdentifier<number>();
  const addEffect = Symbol('ADD_EFFECT');

  let store: Store;

  beforeEach(() => {
    store = new Store();

    store.addNonLazyBehavior(
      counterState,
      merge(store.getTypedEventStream(addEvent), store.getTypedEventStream(multiplyEvent)).pipe(
        withLatestFrom(store.getBehavior(counterState)),
        map(([typedEvent, state]) => {
          if (typedEvent.type === addEvent) {
            return state + typedEvent.event;
          }
          if (typedEvent.type === multiplyEvent) {
            return state * typedEvent.event;
          }
          return state;
        }),
      ),
      0, // => 0
    );

    store.addEventSource(
      addEffect,
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
    store.dispatchEvent(addEvent, 3); // => 3
    store.dispatchEvent(multiplyEvent, 3); // => 9
    store.dispatchEvent(multiplyEvent, 2); // => 18

    await counterSequence;
  });

  it('should preserve the order in which events are dispatched 2', async () => {
    const counterSequence = expectSequence(store.getBehavior(counterState), [0, 3, 9, 10, 20]);

    // now we await the *3 dispatch and thus, the +1 dispatch from the effect comes before the *2 dispatch
    store.dispatchEvent(addEvent, 3); // => 3
    await store.dispatchEvent(multiplyEvent, 3); // => 9 => 10
    store.dispatchEvent(multiplyEvent, 2); // => 20

    await counterSequence;
  });

  describe('examples from documentation', () => {
    it('should work as described in the first example of the documentation', async () => {
      const myEvent = getIdentifier<number>();
      const values: number[] = [];
      const sequence = expectSequence(
        store.getEventStream(myEvent).pipe(tap(v => values.push(v))),
        [3, 4, 5, 6, 7],
      );

      store.addEventSource(
        Symbol(),
        myEvent,
        store.getEventStream(myEvent).pipe(
          filter(v => v === 3),
          mapTo(7),
        ),
      );
      store.addEventSource(Symbol(), myEvent, of(3, 4, 5));
      values.push(1);
      store.dispatchEvent(myEvent, 6);
      values.push(2);

      await sequence;
      expect(values).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it('should work as described in the second example of the documentation', async () => {
      const myEvent = getIdentifier<number>();
      const sequence = expectSequence(
        store.getEventStream(myEvent).pipe(take(14)),
        [1, 2, 6, 21, 7, 22, 11, 26, 26, 41, 12, 27, 27, 42],
      );

      store.addEventSource(
        Symbol('source1'),
        myEvent,
        store.getEventStream(myEvent).pipe(
          map(e => e + 5), // 6, 7 -> 11, 26, 12, 27
        ),
      );
      store.addEventSource(
        Symbol('source2'),
        myEvent,
        store.getEventStream(myEvent).pipe(
          map(e => e + 20), // 21, 22 -> 26, 41, 27, 42
        ),
      );
      store.dispatchEvent(myEvent, 1);
      store.dispatchEvent(myEvent, 2);

      await sequence;
    });
  });
});
