import { Store } from '../src/store';
import { getEventId } from '../src/store-utils';
import { expectSequence } from '../src/test-utils/test-utils';
import { getStateId } from './../src/store-utils';

describe('Reducers', () => {
  const counterState = getStateId<number>();
  const increaseEvent = getEventId<number>();
  const decreaseEvent = getEventId<number>();

  let store: Store;

  beforeEach(() => {
    store = new Store();
  });

  it('should work with adding reducers at arbitrary points of time', async () => {
    const counterSequence = expectSequence(store.getBehavior(counterState), [100, 91, 118, 116]);

    expect(store.getNumberOfBehaviorSources(counterState)).toBe(0);
    store.addReducer(counterState, decreaseEvent, (state, event) => state - event);
    expect(store.getNumberOfBehaviorSources(counterState)).toBe(1);

    await store.dispatch(increaseEvent, 7); // => 100
    await store.dispatch(decreaseEvent, 5); // => 100

    store.addState(counterState, 100);
    expect(store.getNumberOfBehaviorSources(counterState)).toBe(2);

    await store.dispatch(increaseEvent, 17); // => 100
    await store.dispatch(decreaseEvent, 9); // => 91

    store.addReducer(counterState, increaseEvent, (state, event) => state + event);
    expect(store.getNumberOfBehaviorSources(counterState)).toBe(3);

    await store.dispatch(increaseEvent, 27); // => 118
    await store.dispatch(decreaseEvent, 2); // => 116

    await counterSequence;
  });

  it('should work with removing reducers at arbitrary points of time', async () => {
    const counterSequence = expectSequence(store.getBehavior(counterState), [100, 117, 108, 107]);

    store.addState(counterState, 100);

    store.addReducer(counterState, increaseEvent, (state, event) => state + event);
    store.addReducer(counterState, decreaseEvent, (state, event) => state - event);
    expect(store.getNumberOfBehaviorSources(counterState)).toBe(3);

    await store.dispatch(increaseEvent, 17); // => 117
    await store.dispatch(decreaseEvent, 9); // => 108

    expect(store.isSubscribed(increaseEvent)).toBe(true);
    expect(store.isSubscribed(decreaseEvent)).toBe(true);

    store.removeReducer(counterState, increaseEvent);
    expect(store.getNumberOfBehaviorSources(counterState)).toBe(2);

    expect(store.isSubscribed(increaseEvent)).toBe(false);
    expect(store.isSubscribed(decreaseEvent)).toBe(true);

    await store.dispatch(increaseEvent, 30); // => 108
    await store.dispatch(decreaseEvent, 1); // => 107

    await counterSequence;
  });

  it('should not error, when removing a not-added reducer', () => {
    store.addState(counterState, 100);
    store.removeReducer(counterState, increaseEvent);
  });

  it('should throw, when trying to add a second reducer for the same event', () => {
    store.addReducer(counterState, increaseEvent, (state, event) => state + event);
    expect(() => {
      store.addReducer(counterState, increaseEvent, (state, event) => state + event);
    }).toThrowError('A source with the given ID has already been added.: Symbol(E_1)');
  });

  it('should remove all reducer sources when removing the state', () => {
    store.addReducer(counterState, increaseEvent, (state, event) => state + event);
    store.addReducer(counterState, decreaseEvent, (state, event) => state + event);
    store.addState(counterState, 100);
    expect(store.getNumberOfBehaviorSources(counterState)).toBe(3);

    store.removeBehaviorSources(counterState);
    expect(store.getNumberOfBehaviorSources(counterState)).toBe(0);
  });

  it('should work for state of type undefined', async () => {
    const undefinedStateId = getStateId<undefined | number>();
    store.addState(undefinedStateId, undefined);
    store.addReducer(undefinedStateId, increaseEvent, (_, e) => e);
    const sequence = expectSequence(store.getBehavior(undefinedStateId), [undefined, 1]);
    store.dispatch(increaseEvent, 1);
    await sequence;
  });
});
