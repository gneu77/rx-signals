import { map } from 'rxjs';
import { Store } from '../src/store';
import { getStateId } from '../src/store-utils';
import { expectSequence } from '../src/test-utils/test-utils';
import { getEventId } from './../src/store-utils';

describe('Lifecycle basics', () => {
  const numberBehavior = getStateId<number>();
  const numberBehavior2 = getStateId<number>();
  const numberEvent = getEventId<number>();
  const triggerEvent = getEventId<undefined>();

  let store: Store;

  beforeEach(() => {
    store = new Store();
  });

  it('should return a lifecycle handle', () => {
    const handle = store.getLifecycleHandle(s => {
      s.addState(numberBehavior, 5);
    });
    expect(typeof handle.end).toBe('function');
    expect(typeof handle.reset).toBe('function');
  });

  it('should throw, if getLifecycleHandle is called from within a getLifecycle callback', () => {
    expect(() => {
      store.getLifecycleHandle(s => {
        s.getLifecycleHandle(() => {});
      });
    }).toThrowError(
      'getLifecycleHandle cannot be called while already within a lifecycleRegistrationCallback',
    );
  });

  it('should remove event sources when ending a lifecycle', async () => {
    store.addEventSource(numberEvent, store.getEventStream(triggerEvent).pipe(map(() => 1)));
    const handle = store.getLifecycleHandle(s => {
      s.addEventSource(numberEvent, store.getEventStream(triggerEvent).pipe(map(() => 2)));
    });

    const sequence = expectSequence(store.getEventStream(numberEvent), [1, 2, 1, 2]);
    store.dispatch(triggerEvent, undefined);
    store.dispatch(triggerEvent, undefined);
    await sequence;

    const sequence2 = expectSequence(store.getEventStream(numberEvent), [1, 1]);
    handle.end();
    store.dispatch(triggerEvent, undefined);
    store.dispatch(triggerEvent, undefined);
    await sequence2;
  });

  it('should remove behavior sources and complete behavior subscribers when ending a lifecycle', async () => {
    store.addState(numberBehavior, 0);
    store.addReducer(numberBehavior, triggerEvent, state => state + 1);
    const handle = store.getLifecycleHandle(s => {
      s.addState(numberBehavior2, 0);
      s.addReducer(numberBehavior2, triggerEvent, state => state + 1);
    });

    const sequence1 = expectSequence(store.getBehavior(numberBehavior), [0, 1, 2]);
    const sequence2 = expectSequence(store.getBehavior(numberBehavior), [0, 1]);
    expect(store.isSubscribed(numberBehavior)).toBe(true);
    expect(store.isSubscribed(numberBehavior2)).toBe(true);
    await store.dispatch(triggerEvent, undefined);
    expect(store.isSubscribed(numberBehavior)).toBe(true);
    expect(store.isSubscribed(numberBehavior2)).toBe(true);

    expect(store.getNumberOfBehaviorSources(numberBehavior)).toBe(2);
    expect(store.getNumberOfBehaviorSources(numberBehavior2)).toBe(2);
    handle.end();
    expect(store.isSubscribed(numberBehavior)).toBe(true);
    expect(store.isSubscribed(numberBehavior2)).toBe(false);
    expect(store.getNumberOfBehaviorSources(numberBehavior)).toBe(2);
    expect(store.getNumberOfBehaviorSources(numberBehavior2)).toBe(0);
    store.dispatch(triggerEvent, undefined);
    await sequence1;
    await sequence2;
  });

  it('should reset a lifecycle', async () => {
    store.addState(numberBehavior, 0);
    store.addReducer(numberBehavior, triggerEvent, state => state + 1);
    const handle = store.getLifecycleHandle(s => {
      s.addState(numberBehavior2, 0);
      s.addReducer(numberBehavior2, triggerEvent, state => state + 1);
    });

    const sequence1 = expectSequence(store.getBehavior(numberBehavior), [0, 1, 2, 3]);
    const sequence2 = expectSequence(store.getBehavior(numberBehavior2), [0, 1, 2, 0, 1]);
    await store.dispatch(triggerEvent, undefined);
    await store.dispatch(triggerEvent, undefined);
    handle.reset();
    store.dispatch(triggerEvent, undefined);
    await sequence1;
    await sequence2;
  });
});
