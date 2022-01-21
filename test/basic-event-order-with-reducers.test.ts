import { of } from 'rxjs';
import { filter, switchMap } from 'rxjs/operators';
import { Store } from '../src/store';
import { getBehaviorId, getEventId } from '../src/store-utils';
import { expectSequence } from './test.utils';

describe('Event order', () => {
  const counterState = getBehaviorId<number>();
  const addEvent = getEventId<number>();
  const multiplyEvent = getEventId<number>();
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

    store.dispatch(addEvent, 3); // => 3
    store.dispatch(addEvent, 3); // => 6
    store.dispatch(multiplyEvent, 3); // => 18
    store.dispatch(addEvent, 3); // => 21
    store.dispatch(multiplyEvent, 3); // => 63

    await counterSequence;
  });

  it('should preserve the order in which events are dispatched 2', async () => {
    const counterSequence = expectSequence(
      store.getBehavior(counterState),
      [0, 3, 6, 24, 27, 81, 82, 83],
    );

    store.dispatch(addEvent, 3); // => 3
    store.dispatch(addEvent, 3); // => 6
    store.dispatch(multiplyEvent, 4); // => 24 (Queuing effect that adds +1 two times)
    store.dispatch(addEvent, 3); // => 27
    store.dispatch(multiplyEvent, 3); // => 81 => 82 => 83 (82 and 83 from effect)

    await counterSequence;
  });
});
