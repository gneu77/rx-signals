import { merge, Observable } from 'rxjs';
import { map, mapTo, withLatestFrom } from 'rxjs/operators';
import { Store } from '../src/store';
import { getBehaviorId, getEventId } from '../src/store-utils';
import { expectSequence } from '../src/test-utils/test-utils';

describe('completeAllSignals', () => {
  let store: Store;
  let calculationCalled = 0;

  const calculator = (input: number) => {
    calculationCalled = calculationCalled + 1;
    return input * 2;
  };

  const id = getBehaviorId<number>();
  const calculateEvent = getEventId<void>();

  let observable: Observable<number>;

  beforeEach((): void => {
    store = new Store();
    calculationCalled = 0;

    store.addBehavior(
      id,
      store.getEventStream(calculateEvent).pipe(
        withLatestFrom(store.getBehavior(id)),
        map(pair => calculator(pair[1])),
      ),
      false,
      1,
    );

    observable = store.getBehavior(id);
  });

  it('should not do anything after a call to completeAllSignals', async () => {
    const sequence = expectSequence(observable, [1, 2, 4, 8]);
    store.dispatch(calculateEvent, null);
    store.dispatch(calculateEvent, null);
    store.dispatch(calculateEvent, null);
    await sequence;
    await expectSequence(observable, [8]);
    expect(calculationCalled).toBe(3);
    expect(store.isSubscribed(calculateEvent)).toBe(true);

    store.completeAllSignals();
    expect(store.isSubscribed(calculateEvent)).toBe(false);
    const sequence2 = expectSequence(
      merge(store.getEventStream(calculateEvent).pipe(mapTo(3)), observable),
      [3, 3],
    );
    store.dispatch(calculateEvent, null);
    store.dispatch(calculateEvent, null);
    await sequence2;
    expect(calculationCalled).toBe(3);
    expect(store.isSubscribed(calculateEvent)).toBe(false);
  });
});
