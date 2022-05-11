import { Observable } from 'rxjs';
import { map, withLatestFrom } from 'rxjs/operators';
import { Store } from '../src/store';
import { getBehaviorId, getEventId } from '../src/store-utils';
import { expectSequence } from '../src/test-utils/test-utils';

describe('shared behavior state', () => {
  let store: Store;
  let calculationCalled = 0;

  const calculator = (input: number) => {
    calculationCalled = calculationCalled + 1;
    return input * 2;
  };

  const id = getBehaviorId<number>();
  const calculateEvent = getEventId<undefined>();

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
      true,
      1,
    );

    observable = store.getBehavior(id);
  });

  it('should calculate correct values', async () => {
    const sequence = expectSequence(observable, [1, 2, 4, 8]);
    store.dispatch(calculateEvent);
    store.dispatch(calculateEvent);
    store.dispatch(calculateEvent);
    await sequence;
    expect(calculationCalled).toBe(3);
  });

  it('should share calculated values', async () => {
    const sequence = expectSequence(observable, [1, 2, 4, 8]);
    const sequence2 = expectSequence(observable, [1, 2, 4, 8]);
    store.dispatch(calculateEvent);
    store.dispatch(calculateEvent);
    store.dispatch(calculateEvent);
    await sequence;
    await sequence2;
    expect(calculationCalled).toBe(3);
    expect(store.isSubscribed(id)).toBe(false);
    const sequence3 = expectSequence(observable, [8, 16]);
    store.dispatch(calculateEvent);
    await sequence3;
    expect(calculationCalled).toBe(4);
  });

  it('should share calculated values when subscribed at different times', async () => {
    const sequence = expectSequence(observable, [1, 2, 4, 8]);
    const sequence2 = expectSequence(observable, [1, 2, 4, 8, 16]);
    await store.dispatch(calculateEvent);
    await store.dispatch(calculateEvent);
    const sequence3 = expectSequence(observable, [4, 8]);
    store.dispatch(calculateEvent);
    store.dispatch(calculateEvent);
    await sequence;
    await sequence2;
    await sequence3;
    expect(calculationCalled).toBe(4);
  });
});
