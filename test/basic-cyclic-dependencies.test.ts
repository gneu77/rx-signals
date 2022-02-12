import { map, withLatestFrom } from 'rxjs/operators';
import { Store } from '../src/store';
import { getBehaviorId, getEventId } from '../src/store-utils';
import { expectSequence } from './test.utils';
describe('Cyclic dependencies', () => {
  const cyclicBehavior = getBehaviorId<number>();
  const derivedBehavior = getBehaviorId<number>();
  const inputEvent = getEventId<number>();

  let store: Store;

  beforeEach(() => {
    store = new Store();

    // derivedBehavior depends on cyclicBehavior && cyclicBehavior depends on derivedBehavior

    store.addBehavior(
      cyclicBehavior,
      store
        .getEventStream(inputEvent)
        .pipe(withLatestFrom(store.getBehavior(derivedBehavior).pipe(map(val => val * 10))))
        .pipe(map(pair => pair[0] * pair[1])),
      true,
      1,
    );

    store.addBehavior(
      derivedBehavior,
      store.getBehavior(cyclicBehavior).pipe(map(val => val * 10)),
      true,
    );
  });

  it('should have correct initial value', async () => {
    expect(store.isSubscribed(cyclicBehavior)).toBe(false);
    expect(store.isSubscribed(derivedBehavior)).toBe(false);
    expect(store.isSubscribed(inputEvent)).toBe(false);

    await expectSequence(store.getBehavior(derivedBehavior), [10]);

    expect(store.isSubscribed(cyclicBehavior)).toBe(false);
    expect(store.isSubscribed(derivedBehavior)).toBe(false);
    expect(store.isSubscribed(inputEvent)).toBe(false);
  });

  it('should get correct value on first dispatch', async () => {
    expect(store.isSubscribed(cyclicBehavior)).toBe(false);
    expect(store.isSubscribed(derivedBehavior)).toBe(false);
    expect(store.isSubscribed(inputEvent)).toBe(false);

    const sequence = expectSequence(store.getBehavior(derivedBehavior), [10, 1000]);

    expect(store.isSubscribed(cyclicBehavior)).toBe(true);
    expect(store.isSubscribed(derivedBehavior)).toBe(true);
    expect(store.isSubscribed(inputEvent)).toBe(true);

    store.dispatch(inputEvent, 1);

    await sequence;

    expect(store.isSubscribed(cyclicBehavior)).toBe(false);
    expect(store.isSubscribed(derivedBehavior)).toBe(false);
    expect(store.isSubscribed(inputEvent)).toBe(false);
  });

  it('should not change, if second event sent while unsubscribed', async () => {
    const sequence = expectSequence(store.getBehavior(derivedBehavior), [10, 1000]);

    store.dispatch(inputEvent, 1);

    await sequence;

    await store.dispatch(inputEvent, 2);

    await expectSequence(store.getBehavior(derivedBehavior), [1000]);
  });

  it('should get correct value on dispatch after resubscribe', async () => {
    const sequence = expectSequence(store.getBehavior(derivedBehavior), [10, 1000]);

    store.dispatch(inputEvent, 1);

    await sequence;

    await store.dispatch(inputEvent, 2);

    const sequence2 = expectSequence(store.getBehavior(derivedBehavior), [1000, 300000]);

    await store.dispatch(inputEvent, 3);

    await sequence2;
  });
});
