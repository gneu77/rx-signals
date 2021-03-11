import { expectSequence } from './test.utils';
import { merge, of } from 'rxjs';
import { filter, map, switchMap, withLatestFrom } from 'rxjs/operators';
import { Store, TypeIdentifier } from '../src/store';

describe('Event order', () => {
  const counterState: TypeIdentifier<number> = { symbol: Symbol('COUNTER_STATE') };
  const addEvent: TypeIdentifier<number> = { symbol: Symbol('ADD_STATE') };
  const multiplyEvent: TypeIdentifier<number> = { symbol: Symbol('MULTIPLY_STATE') };
  const addEffect = Symbol('ADD_EFFECT');

  let store: Store;

  beforeEach(() => {
    store = new Store();

    store.addStatefulBehavior(
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
});
