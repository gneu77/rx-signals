import { Store } from '../src/store';
import { getBehaviorId, getEventId } from '../src/store-utils';
import { expectSequence } from './test.utils';

describe('Connect basics', () => {
  const sourceEventId = getEventId<number>();
  const sourceBehaviorId = getBehaviorId<number>();
  const targetEventId = getEventId<number | null>();
  const targetBehaviorId = getBehaviorId<number | null>();

  let store: Store;

  beforeEach(() => {
    store = new Store();
    store.addState(sourceBehaviorId, 3);
    store.addReducer(sourceBehaviorId, sourceEventId, (_, e) => e);
  });

  it('should return void, if the target is a behavior', () => {
    const test: void = store.connect(sourceEventId, targetBehaviorId);
    expect(typeof test).toBe('undefined');
  });

  it('should connect event to behavior, subscribing the target eagerly on default', async () => {
    expect(store.getNumberOfBehaviorSources(targetBehaviorId)).toBe(0);
    store.connect(sourceEventId, targetBehaviorId);
    expect(store.getNumberOfBehaviorSources(targetBehaviorId)).toBe(1);
    expect(store.isSubscribed(targetBehaviorId)).toBe(true);
    await store.dispatch(sourceEventId, 5); // not missed, due to eager subscription
    const sequence = expectSequence(store.getBehavior(targetBehaviorId), [5, 7]);
    store.dispatch(sourceEventId, 7);
    await sequence;
  });

  it('should connect event to behavior, subscribing the target lazily', async () => {
    expect(store.getNumberOfBehaviorSources(targetBehaviorId)).toBe(0);
    store.connect(sourceEventId, targetBehaviorId, true);
    expect(store.getNumberOfBehaviorSources(targetBehaviorId)).toBe(1);
    expect(store.isSubscribed(targetBehaviorId)).toBe(false);
    await store.dispatch(sourceEventId, 5); // missed, due to laziy subscription
    const sequence = expectSequence(store.getBehavior(targetBehaviorId), [7]);
    store.dispatch(sourceEventId, 7);
    await sequence;
  });

  it('should connect behavior to behavior, subscribing the target lazily on default', async () => {
    expect(store.getNumberOfBehaviorSources(targetBehaviorId)).toBe(0);
    store.connect(sourceBehaviorId, targetBehaviorId);
    expect(store.getNumberOfBehaviorSources(targetBehaviorId)).toBe(1);
    expect(store.isSubscribed(targetBehaviorId)).toBe(false);
    const sequence = expectSequence(store.getBehavior(targetBehaviorId), [3, 7]);
    expect(store.isSubscribed(targetBehaviorId)).toBe(true);
    store.dispatch(sourceEventId, 7);
    await sequence;
  });

  it('should connect behavior to behavior, subscribing the target eagerly', async () => {
    expect(store.getNumberOfBehaviorSources(targetBehaviorId)).toBe(0);
    store.connect(sourceBehaviorId, targetBehaviorId, false);
    expect(store.getNumberOfBehaviorSources(targetBehaviorId)).toBe(1);
    expect(store.isSubscribed(targetBehaviorId)).toBe(true);
    const sequence = expectSequence(store.getBehavior(targetBehaviorId), [3, 7]);
    store.dispatch(sourceEventId, 7);
    await sequence;
  });

  it('should connect event to event, returning a symbol that can be used to remove the target event source', async () => {
    const targetEventSource: symbol = store.connect(sourceEventId, targetEventId);
    expect(typeof targetEventSource).toBe('symbol');
    await store.dispatch(sourceEventId, 5); // missed
    const sequence = expectSequence(store.getEventStream(targetEventId), [7, 42]);
    await store.dispatch(sourceEventId, 7); // not missed
    store.removeEventSource(targetEventSource);
    store.dispatch(sourceEventId, 9); // missed, due to removed source
    store.dispatch(targetEventId, 42); // to verify that 9 was missed
    await sequence;
  });
});
