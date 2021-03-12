import { expectSequence } from './test.utils';
import { merge, of } from 'rxjs';
import { filter, map, switchMap, withLatestFrom } from 'rxjs/operators';
import { Store, TypeIdentifier } from '../src/store';

describe('Effect loops', () => {
  const counterState: TypeIdentifier<number> = { symbol: Symbol('COUNTER_STATE') };
  const addEvent: TypeIdentifier<number> = { symbol: Symbol('ADD_STATE') };
  const multiplyEvent: TypeIdentifier<number> = { symbol: Symbol('MULTIPLY_STATE') };

  const addEffect = Symbol('ADD_EFFECT');
  const multiplyEffect = Symbol('MULTIPLY_EFFECT');

  let store: Store;

  beforeEach(() => {
    store = new Store();
  });

  it('should perform an effect on a certain condition and result in correct behavior', async () => {
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

    const counterSequence = expectSequence(store.getBehavior(counterState), [0, 5, 10, 23, 25, 50]);

    store.addEventSource(
      addEffect,
      addEvent,
      store.getBehavior(counterState).pipe(
        filter(counter => counter === 10),
        switchMap(() => of(13)), // => 23
      ),
    );

    store.addEventSource(
      multiplyEffect,
      multiplyEvent,
      store.getBehavior(counterState).pipe(
        filter(counter => counter === 25),
        switchMap(() => of(2)), // => 50
      ),
    );

    await store.dispatchEvent(addEvent, 5); // => 5
    await store.dispatchEvent(addEvent, 5); // => 10 => 23
    await store.dispatchEvent(addEvent, 2); // => 25 => 50

    await counterSequence;
  });

  it('should also work with state/reducer convenience API', async () => {
    store.addState(counterState, 0); // => 0
    store.addReducer(counterState, addEvent, (counter, event) => counter + event);
    store.addReducer(counterState, multiplyEvent, (counter, event) => counter * event);

    const counterSequence = expectSequence(store.getBehavior(counterState), [0, 5, 10, 23, 25, 50]);

    store.addEventSource(
      addEffect,
      addEvent,
      store.getBehavior(counterState).pipe(
        filter(counter => counter === 10),
        switchMap(() => of(13)), // => 23
      ),
    );

    store.addEventSource(
      multiplyEffect,
      multiplyEvent,
      store.getBehavior(counterState).pipe(
        filter(counter => counter === 25),
        switchMap(() => of(2)), // => 50
      ),
    );

    await store.dispatchEvent(addEvent, 5); // => 5
    await store.dispatchEvent(addEvent, 5); // => 10 => 23
    await store.dispatchEvent(addEvent, 2); // => 25 => 50

    await counterSequence;
  });
});
