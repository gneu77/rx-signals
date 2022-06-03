import { merge, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Store } from '../src/store';
import { getEventId, getStateId } from '../src/store-utils';
import { expectSequence } from '../src/test-utils/test-utils';

describe('completeAllSignals', () => {
  let store: Store;
  let calculationCalled = 0;

  const calculator = (input: number): number => {
    calculationCalled = calculationCalled + 1;
    return input * 2;
  };

  const id = getStateId<number>();
  const calculateEvent = getEventId<void>();

  let observable: Observable<number>;

  beforeEach((): void => {
    store = new Store();
    calculationCalled = 0;

    store.addState(id, 1);
    store.addReducer(id, calculateEvent, calculator);

    observable = store.getBehavior(id);
  });

  it('should not do anything after a call to completeAllSignals', async () => {
    const sequence = expectSequence(observable, [1, 2, 4, 8]);
    store.dispatch(calculateEvent);
    store.dispatch(calculateEvent);
    store.dispatch(calculateEvent);
    await sequence;
    await expectSequence(observable, [8]);
    expect(calculationCalled).toBe(3);
    expect(store.isSubscribed(calculateEvent)).toBe(true);

    store.completeAllSignals();
    expect(store.isSubscribed(calculateEvent)).toBe(false);
    const sequence2 = expectSequence(
      merge(store.getEventStream(calculateEvent).pipe(map(() => 3)), observable),
      [3, 3],
    );
    store.dispatch(calculateEvent);
    store.dispatch(calculateEvent);
    await sequence2;
    expect(calculationCalled).toBe(3);
    expect(store.isSubscribed(calculateEvent)).toBe(false);
  });
});
