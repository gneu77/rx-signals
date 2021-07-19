import { map, withLatestFrom } from 'rxjs/operators';
import { Store } from '../src/store';
import { TypeIdentifier } from '../src/store.utils';
import { expectSequence } from './test.utils';
describe('Cyclic dependencies', () => {
  const cyclicBehavior: TypeIdentifier<number> = { symbol: Symbol('CyclicBehavior') };
  const derivedBehavior: TypeIdentifier<number> = { symbol: Symbol('DerivedBehavior') };
  const inputEvent: TypeIdentifier<number> = { symbol: Symbol('InputEvent') };

  let store: Store;

  beforeEach(() => {
    store = new Store();

    // derivedBehavior depends on cyclicBehavior && cyclicBehavior depends on derivedBehavior

    store.addLazyBehavior(
      cyclicBehavior,
      store
        .getEventStream(inputEvent)
        .pipe(withLatestFrom(store.getBehavior(derivedBehavior).pipe(map(val => val * 10))))
        .pipe(map(pair => pair[0] * pair[1])),
      1,
    );

    store.addLazyBehavior(
      derivedBehavior,
      store.getBehavior(cyclicBehavior).pipe(map(val => val * 10)),
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

    store.dispatchEvent(inputEvent, 1);

    await sequence;

    expect(store.isSubscribed(cyclicBehavior)).toBe(false);
    expect(store.isSubscribed(derivedBehavior)).toBe(false);
    expect(store.isSubscribed(inputEvent)).toBe(false);
  });

  it('should not change, if second event sent while unsubscribed', async () => {
    const sequence = expectSequence(store.getBehavior(derivedBehavior), [10, 1000]);

    store.dispatchEvent(inputEvent, 1);

    await sequence;

    await store.dispatchEvent(inputEvent, 2);

    await expectSequence(store.getBehavior(derivedBehavior), [1000]);
  });

  it('should get correct value on dispatch after resubscribe', async () => {
    const sequence = expectSequence(store.getBehavior(derivedBehavior), [10, 1000]);

    store.dispatchEvent(inputEvent, 1);

    await sequence;

    await store.dispatchEvent(inputEvent, 2);

    const sequence2 = expectSequence(store.getBehavior(derivedBehavior), [1000, 300000]);

    await store.dispatchEvent(inputEvent, 3);

    await sequence2;
  });
});
