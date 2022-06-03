import { of } from 'rxjs';
import { filter, switchMap } from 'rxjs/operators';
import { Store } from '../src/store';
import { expectSequence } from '../src/test-utils/test-utils';
import { getEventId, getStateId } from './../src/store-utils';

describe('Effect loops', () => {
  const counterState = getStateId<number>();
  const addEvent = getEventId<number>();
  const multiplyEvent = getEventId<number>();

  let store: Store;

  beforeEach(() => {
    store = new Store();
  });

  it('should perform an effect on a certain condition and result in correct behavior', async () => {
    store.addState(counterState, 0);
    store.addReducer(counterState, addEvent, (s, e) => s + e);
    store.addReducer(counterState, multiplyEvent, (s, e) => s * e);

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
