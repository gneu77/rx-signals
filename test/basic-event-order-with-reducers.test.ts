import { of } from 'rxjs';
import { filter, switchMap } from 'rxjs/operators';
import { Store } from '../src/store';
import { TypeIdentifier } from '../src/store.utils';
import { expectSequence } from './test.utils';

describe('Event order', () => {
  const counterState: TypeIdentifier<number> = { symbol: Symbol('COUNTER_STATE') };
  const addEvent: TypeIdentifier<number> = { symbol: Symbol('ADD_EVENT') };
  const multiplyEvent: TypeIdentifier<number> = { symbol: Symbol('MULTIPLY_EVENT') };
  const addEffect = Symbol('ADD_EFFECT');

  let store: Store;

  beforeEach(() => {
    store = new Store();

    store.addState(counterState, 0);

    store.addReducer(counterState, addEvent, (state, event) => state + event);

    store.addReducer(counterState, multiplyEvent, (state, event) => state * event);

    store.addEventSource(
      addEffect,
      addEvent,
      store.getBehavior(counterState).pipe(
        filter(counter => counter === 24),
        switchMap(() => of(1, 1)),
      ),
    );
  });

  it('should preserve the order in which events are dispatched 1', async () => {
    const counterSequence = expectSequence(store.getBehavior(counterState), [0, 3, 6, 18, 21, 63]);

    store.dispatchEvent(addEvent, 3); // => 3
    store.dispatchEvent(addEvent, 3); // => 6
    store.dispatchEvent(multiplyEvent, 3); // => 18
    store.dispatchEvent(addEvent, 3); // => 21
    store.dispatchEvent(multiplyEvent, 3); // => 63

    await counterSequence;
  });

  it('should preserve the order in which events are dispatched 2', async () => {
    const counterSequence = expectSequence(store.getBehavior(counterState), [
      0,
      3,
      6,
      24,
      27,
      81,
      82,
      83,
    ]);

    store.dispatchEvent(addEvent, 3); // => 3
    store.dispatchEvent(addEvent, 3); // => 6
    store.dispatchEvent(multiplyEvent, 4); // => 24 (Queuing effect that adds +1 two times)
    store.dispatchEvent(addEvent, 3); // => 27
    store.dispatchEvent(multiplyEvent, 3); // => 81 => 82 => 83 (82 and 83 from effect)

    await counterSequence;
  });
});
