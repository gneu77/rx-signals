import { merge, of } from 'rxjs';
import { filter, map, switchMap, withLatestFrom } from 'rxjs/operators';
import { Store } from '../src/store';
import { getBehaviorId, getEventId } from './../src/store-utils';
import { expectSequence } from './test.utils';

describe('Effect loops', () => {
  const counterState = getBehaviorId<number>();
  const addEvent = getEventId<number>();
  const multiplyEvent = getEventId<number>();

  let store: Store;

  beforeEach(() => {
    store = new Store();
  });

  it('should perform an effect on a certain condition and result in correct behavior', async () => {
    store.addBehavior(
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
      false,
      0, // => 0
    );

    const counterSequence = expectSequence(store.getBehavior(counterState), [0, 5, 10, 23, 25, 50]);

    store.addEventSource(
      addEvent,
      store.getBehavior(counterState).pipe(
        filter(counter => counter === 10),
        switchMap(() => of(13)), // => 23
      ),
    );

    store.addEventSource(
      multiplyEvent,
      store.getBehavior(counterState).pipe(
        filter(counter => counter === 25),
        switchMap(() => of(2)), // => 50
      ),
    );

    await store.dispatch(addEvent, 5); // => 5
    await store.dispatch(addEvent, 5); // => 10 => 23
    await store.dispatch(addEvent, 2); // => 25 => 50

    await counterSequence;
  });

  it('should also work with state/reducer convenience API', async () => {
    store.addState(counterState, 0); // => 0
    store.addReducer(counterState, addEvent, (counter, event) => counter + event);
    store.addReducer(counterState, multiplyEvent, (counter, event) => counter * event);

    const counterSequence = expectSequence(store.getBehavior(counterState), [0, 5, 10, 23, 25, 50]);

    store.addEventSource(
      addEvent,
      store.getBehavior(counterState).pipe(
        filter(counter => counter === 10),
        switchMap(() => of(13)), // => 23
      ),
    );

    store.addEventSource(
      multiplyEvent,
      store.getBehavior(counterState).pipe(
        filter(counter => counter === 25),
        switchMap(() => of(2)), // => 50
      ),
    );

    await store.dispatch(addEvent, 5); // => 5
    await store.dispatch(addEvent, 5); // => 10 => 23
    await store.dispatch(addEvent, 2); // => 25 => 50

    await counterSequence;
  });
});
