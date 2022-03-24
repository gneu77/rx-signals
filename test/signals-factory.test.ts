import { combineLatest, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { Store } from '../src/store';
import { SignalsFactory } from './../src/signals-factory';
import { BehaviorId, EventId, getBehaviorId, getEventId } from './../src/store-utils';
import { expectSequence } from './test.utils';

describe('SignalsFactory', () => {
  const operationAdd = 'add';
  const operationMultiply = 'multiply';
  type Operation = typeof operationAdd | typeof operationMultiply;
  type BaseInput = {
    inputA: BehaviorId<number>;
    inputB: BehaviorId<number>;
    inputC: BehaviorId<number | null>;
    inputD: BehaviorId<string>; // unused
  };
  type BaseOutput = {
    result: BehaviorId<number>;
    outputC: BehaviorId<number | null>;
    outputD: BehaviorId<string>; // unused
  };
  type BaseConfig = {
    operation?: Operation;
  };
  type BaseFactory = SignalsFactory<BaseInput, BaseOutput, BaseConfig>;

  const baseFactory: BaseFactory = new SignalsFactory<BaseInput, BaseOutput, BaseConfig>(
    (config: BaseConfig) => {
      const inputA = getBehaviorId<number>();
      const inputB = getBehaviorId<number>();
      const inputC = getBehaviorId<number | null>();
      const inputD = getBehaviorId<string>(); // not used
      const result = getBehaviorId<number>();
      const outputC = getBehaviorId<number | null>();
      const outputD = getBehaviorId<string>(); // not used
      const operation = config.operation ?? operationAdd;
      return {
        input: {
          inputA,
          inputB,
          inputC,
          inputD,
        },
        output: {
          result,
          outputC,
          outputD,
        },
        setup: store => {
          store.addDerivedState(
            result,
            combineLatest([store.getBehavior(inputA), store.getBehavior(inputB)]).pipe(
              map(([a, b]) => (operation === operationAdd ? a + b : a * b)),
            ),
          );
          store.connect(inputC, outputC);
        },
      };
    },
  );

  let store: Store;

  beforeEach(() => {
    store = new Store();
  });

  describe('base', () => {
    it('should work with default config', async () => {
      const signals = baseFactory.build({});
      signals.setup(store);
      const sequence = expectSequence(store.getBehavior(signals.output.result), [5, 7, 3]);
      store.addDerivedState(signals.input.inputA, of(4));
      store.addDerivedState(signals.input.inputB, of(1, 3, -1));
      await sequence;
    });

    it('should work with given config', async () => {
      const signals = baseFactory.build({
        operation: operationMultiply,
      });
      signals.setup(store);
      const sequence = expectSequence(store.getBehavior(signals.output.result), [4, 12, -4]);
      store.addDerivedState(signals.input.inputA, of(4));
      store.addDerivedState(signals.input.inputB, of(1, 3, -1));
      await sequence;
    });
  });

  describe('modify input/output ids', () => {
    it('should add a single input signal id', async () => {
      const myEvent = getEventId<number>();
      const signals = baseFactory.addOrReplaceInputId('newKey', () => myEvent).build({});
      const sequence = expectSequence(store.getEventStream(signals.input.newKey), [5, 7]);
      store.dispatch(myEvent, 5);
      store.dispatch(myEvent, 7);
      await sequence;
    });

    it('should add a single output signal id', async () => {
      const myEvent = getEventId<number>();
      const signals = baseFactory.addOrReplaceOutputId('newKey', () => myEvent).build({});
      const sequence = expectSequence(store.getEventStream(signals.output.newKey), [5, 7]);
      store.dispatch(myEvent, 5);
      store.dispatch(myEvent, 7);
      await sequence;
    });

    it('should replace a single input signal id', async () => {
      const myEvent = getEventId<number>();
      const signals = baseFactory.addOrReplaceInputId('inputA', () => myEvent).build({});
      const sequence = expectSequence(store.getEventStream(signals.input.inputA), [5, 7]);
      store.dispatch(myEvent, 5);
      store.dispatch(myEvent, 7);
      await sequence;
    });

    it('should replace a single output signal id', async () => {
      const myEvent = getEventId<number>();
      const signals = baseFactory.addOrReplaceOutputId('result', () => myEvent).build({});
      const sequence = expectSequence(store.getEventStream(signals.output.result), [5, 7]);
      store.dispatch(myEvent, 5);
      store.dispatch(myEvent, 7);
      await sequence;
    });

    it('should rename a single input signal id', async () => {
      const myEvent = getEventId<number>();
      const signals = baseFactory.renameInputId('inputA', 'test').build({});
      const sequence = expectSequence(store.getBehavior(signals.input.test), [5, 7]);
      store.connect(myEvent, signals.input.test);
      store.dispatch(myEvent, 5);
      store.dispatch(myEvent, 7);
      await sequence;
    });

    it('should rename a single output signal id', async () => {
      const myEvent = getEventId<number>();
      const signals = baseFactory.renameOutputId('result', 'test').build({});
      const sequence = expectSequence(store.getBehavior(signals.output.test), [10, 12]);
      store.connect(myEvent, signals.input.inputA);
      store.connect(myEvent, signals.input.inputB);
      signals.setup(store);
      store.dispatch(myEvent, 5);
      store.dispatch(myEvent, 7);
      await sequence;
    });
  });

  describe('composition', () => {
    type TripledInput = {
      tripleInput: BehaviorId<number>;
      someNotUsedFakeInput: BehaviorId<string>;
      someOtherNotUsedFakeInput: EventId<number>;
    };
    type TripledOutput = {
      tripledResult: BehaviorId<number>;
      subIds: {
        someNotUsedFakeOutput: BehaviorId<number>;
      };
    };
    type TripledFactory = SignalsFactory<TripledInput, TripledOutput, {}>;

    const tripledFactory: TripledFactory = new SignalsFactory<TripledInput, TripledOutput, {}>(
      () => {
        const tripleInput = getBehaviorId<number>();
        const someNotUsedFakeInput = getBehaviorId<string>();
        const someOtherNotUsedFakeInput = getEventId<number>();
        const someNotUsedFakeOutput = getBehaviorId<number>();
        const tripledResult = getBehaviorId<number>();
        return {
          input: {
            tripleInput,
            someNotUsedFakeInput,
            someOtherNotUsedFakeInput,
          },
          output: {
            tripledResult,
            subIds: {
              someNotUsedFakeOutput,
            },
          },
          setup: store => {
            store.addDerivedState(
              tripledResult,
              store.getBehavior(tripleInput).pipe(map(n => 3 * n)),
            );
          },
        };
      },
    );

    it('should connectObservable, also if source-value-type only extends target-value-type', async () => {
      const myEvent = getEventId<number>();
      // const myEvent2 = getEventId<number | null>();
      const signals = baseFactory
        .connectObservable(st => st.getEventStream(myEvent), 'inputC', false, true) // no problem, because number is assignable to number | null
        // .connectObservable(st => st.getEventStream(myEvent2), 'inputB', false, true) // compiler must error that null is not assignable to number
        // .connectObservable(st => st.getEventStream(myEvent), 'inputD', false, true) // compiler must error that number is not assignable to string
        .build({});
      signals.setup(store);
      const sequence = expectSequence(store.getBehavior(signals.output.outputC), [5, 7]);
      store.dispatch(myEvent, 5);
      store.dispatch(myEvent, 7);
      await sequence;
    });

    it('should connectId, also if source-value-type only extends target-value-type', () => {
      baseFactory
        .connectId(getEventId<string>(), 'inputD', true) // no problem, because value-types match exactly
        .connectId(getEventId<number>(), 'inputC', true) // no problem, because number is assignable to number | null
        // .connectId(getEventId<number | null>(), 'inputB', true) // compiler must error that null is not assignable to number
        // .connectId(getEventId<number | null>(), 'inputD', true) // compiler must error that number is not assignable to string
        .build({});
    });

    it('should connect, also if source-value-type only extends target-value-type', () => {
      baseFactory
        .connect('outputD', 'inputD', true) // no problem, because value-types match exactly
        .connect('result', 'inputC', true) // no problem, because number is assignable to number | null
        // .connect('outputC', 'inputB', true) // compiler must error that '"outputC"' is not assignable to parameter of type '"result"'
        // .connect('outputC', 'inputD', true) // compiler must error that '"outputC"' is not assignable to parameter of type '"outputD"'
        .build({});
    });

    it('should compose and connect output to input', async () => {
      const signals = baseFactory
        .compose(tripledFactory)
        .connect('result', 'tripleInput', false)
        // .connect('result', 'someNotUsedFakeInput', false) // here the compiler should complain!
        .connect('result', 'someOtherNotUsedFakeInput', false) // does nothing, but must be OK for the compiler
        .build({});
      signals.setup(store);
      const sequence = expectSequence(store.getBehavior(signals.output.tripledResult), [15, 21, 9]);
      store.addDerivedState(signals.input.inputA, of(4));
      store.addDerivedState(signals.input.inputB, of(1, 3, -1));
      await sequence;
    });
  });

  describe('mapOutputBehavior', () => {
    it('should map output behaviors', async () => {
      const signals = baseFactory
        .mapOutputBehavior('result', old => old.pipe(map(n => n % 2 === 0)))
        .build({});
      signals.setup(store);
      const sequence = expectSequence(store.getBehavior(signals.output.result), [
        true, // 4
        false, // 5, 7 (only one false due to distinctUntilChanged)
        true, // 2
      ]);
      store.addDerivedState(signals.input.inputA, of(4));
      store.addDerivedState(signals.input.inputB, of(0, 1, 3, -2));
      await sequence;
    });
  });
});
