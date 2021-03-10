import { take } from 'rxjs/operators';
import { Store, TypeIdentifier } from '../src/store';

describe('Reducers', () => {
  const stateIdentifier: TypeIdentifier<{ counter: number }> = { symbol: Symbol('TEST_STATE') };
  const increaseEvent: TypeIdentifier<number> = { symbol: Symbol('INCREASE_EVENT') };
  const decreaseEvent: TypeIdentifier<number> = { symbol: Symbol('DECREASE_EVENT') };

  let store: Store;

  beforeEach(() => {
    store = new Store();
  });

  it('should work with adding reducers at arbitrary points of time', async done => {
    store.addReducer(stateIdentifier, decreaseEvent, (state, event) => ({
      counter: state.counter - event,
    }));

    let dispatchResult: boolean | null = null;

    dispatchResult = await store.dispatchEvent(increaseEvent, 7); // => 100
    expect(dispatchResult).toBe(false);
    dispatchResult = await store.dispatchEvent(decreaseEvent, 5); // => 100
    expect(dispatchResult).toBe(true);

    store.addState(stateIdentifier, {
      counter: 100,
    });

    dispatchResult = await store.dispatchEvent(increaseEvent, 17); // => 100
    expect(dispatchResult).toBe(false);
    dispatchResult = await store.dispatchEvent(decreaseEvent, 9); // => 91
    expect(dispatchResult).toBe(true);

    store.addReducer(stateIdentifier, increaseEvent, (state, event) => ({
      counter: state.counter + event,
    }));

    dispatchResult = await store.dispatchEvent(increaseEvent, 27); // => 118
    expect(dispatchResult).toBe(true);
    dispatchResult = await store.dispatchEvent(decreaseEvent, 2); // => 116
    expect(dispatchResult).toBe(true);

    store
      .getBehavior(stateIdentifier)
      .pipe(take(1))
      .subscribe(state => {
        expect(state.counter).toBe(116);
        done();
      });
  });

  it('should work with removing reducers at arbitrary points of time', async done => {
    store.addState(stateIdentifier, {
      counter: 100,
    });

    store.addReducer(stateIdentifier, increaseEvent, (state, event) => ({
      counter: state.counter + event,
    }));

    store.addReducer(stateIdentifier, decreaseEvent, (state, event) => ({
      counter: state.counter - event,
    }));

    await store.dispatchEvent(increaseEvent, 17); // => 117
    await store.dispatchEvent(decreaseEvent, 9); // => 108

    expect(store.isSubscribed(increaseEvent)).toBe(true);
    expect(store.isSubscribed(decreaseEvent)).toBe(true);

    store.removeReducer(stateIdentifier, increaseEvent);

    expect(store.isSubscribed(increaseEvent)).toBe(false);
    expect(store.isSubscribed(decreaseEvent)).toBe(true);

    await store.dispatchEvent(increaseEvent, 30); // => 108
    await store.dispatchEvent(decreaseEvent, 1); // => 107

    store
      .getBehavior(stateIdentifier)
      .pipe(take(1))
      .subscribe(state => {
        expect(state.counter).toBe(107);
        done();
      });
  });

  it('should throw, when trying to add a second reducer for the same event', () => {
    store.addReducer(stateIdentifier, increaseEvent, (state, event) => ({
      counter: state.counter + event,
    }));
    expect(() => {
      store.addReducer(stateIdentifier, increaseEvent, (state, event) => ({
        counter: state.counter + event,
      }));
    }).toThrowError('A source with the given ID has already been added.: Symbol(INCREASE_EVENT)');
  });

  it('should remove all reducer sources when removing the state', () => {
    store.addReducer(stateIdentifier, increaseEvent, (state, event) => ({
      counter: state.counter + event,
    }));
    store.addReducer(stateIdentifier, decreaseEvent, (state, event) => ({
      counter: state.counter - event,
    }));
    expect(store.getNumberOfBehaviorSources(stateIdentifier)).toBe(2);

    store.addState(stateIdentifier, {
      counter: 100,
    });
    expect(store.getNumberOfBehaviorSources(stateIdentifier)).toBe(3);

    store.removeBehavior(stateIdentifier);
    expect(store.getNumberOfBehaviorSources(stateIdentifier)).toBe(0);
  });
});
