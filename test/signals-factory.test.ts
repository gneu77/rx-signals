import { combineLatest, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { Store } from '../src/store';
import { expectSequence } from '../src/test-utils/test-utils';
import { SignalsFactory } from './../src/signals-factory';
import { DerivedId, EventId, getDerivedId, getEventId } from './../src/store-utils';

describe('SignalsFactory', () => {
  const operationAdd = 'add';
  const operationMultiply = 'multiply';
  type Operation = typeof operationAdd | typeof operationMultiply;
  type BaseInput = {
    inputA: DerivedId<number>;
    inputB: DerivedId<number>;
    inputC: DerivedId<number | null>;
    inputD: DerivedId<string>; // unused
  };
  type BaseOutput = {
    result: DerivedId<number>;
    outputC: DerivedId<number | null>;
    outputD: DerivedId<string>; // unused
  };
  type BaseConfig = {
    operation?: Operation;
  };
  type BaseFactory = SignalsFactory<BaseInput, BaseOutput, BaseConfig>;

  const baseFactory: BaseFactory = new SignalsFactory<BaseInput, BaseOutput, BaseConfig>(
    (config: BaseConfig) => {
      const inputA = getDerivedId<number>();
      const inputB = getDerivedId<number>();
      const inputC = getDerivedId<number | null>();
      const inputD = getDerivedId<string>(); // not used
      const result = getDerivedId<number>();
      const outputC = getDerivedId<number | null>();
      const outputD = getDerivedId<string>(); // not used
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
        effects: {},
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
      const signals = baseFactory.addInputId('newKey', () => myEvent).build({});
      const sequence = expectSequence(store.getEventStream(signals.input.newKey), [5, 7]);
      store.dispatch(myEvent, 5);
      store.dispatch(myEvent, 7);
      await sequence;
    });

    it('should add a single output signal id', async () => {
      const myEvent = getEventId<number>();
      const signals = baseFactory.addOutputId('newKey', () => myEvent).build({});
      const sequence = expectSequence(store.getEventStream(signals.output.newKey), [5, 7]);
      store.dispatch(myEvent, 5);
      store.dispatch(myEvent, 7);
      await sequence;
    });

    // should give type error for addOutputId, cause output 'result' already exists:
    // it('should replace a single output signal id', async () => {
    //   const myEvent = getEventId<number>();
    //   const signals = baseFactory.addOutputId('result', () => myEvent).build({});
    //   const sequence = expectSequence(store.getEventStream(signals.output.result), [5, 7]);
    //   store.dispatch(myEvent, 5);
    //   store.dispatch(myEvent, 7);
    //   await sequence;
    // });

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
      tripleInput: DerivedId<number>;
      someNotUsedFakeInput: DerivedId<string>;
      someOtherNotUsedFakeInput: EventId<number>;
    };
    type TripledOutput = {
      tripledResult: DerivedId<number>;
      subIds: {
        someNotUsedFakeOutput: DerivedId<number>;
      };
    };
    type TripledFactory = SignalsFactory<TripledInput, TripledOutput>;

    const tripledFactory: TripledFactory = new SignalsFactory<TripledInput, TripledOutput>(() => {
      const tripleInput = getDerivedId<number>();
      const someNotUsedFakeInput = getDerivedId<string>();
      const someOtherNotUsedFakeInput = getEventId<number>();
      const someNotUsedFakeOutput = getDerivedId<number>();
      const tripledResult = getDerivedId<number>();
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
        effects: {},
        setup: store => {
          store.addDerivedState(
            tripledResult,
            store.getBehavior(tripleInput).pipe(map(n => 3 * n)),
          );
        },
      };
    });

    it('should connectObservable, also if source-value-type only extends target-value-type', async () => {
      const myEvent = getEventId<number>();
      // const myEvent2 = getEventId<number | null>();
      const signals = baseFactory
        .connectObservable(({ store }) => store.getEventStream(myEvent), 'inputC', false) // no problem, because number is assignable to number | null
        // .connectObservable(st => st.getEventStream(myEvent2), 'inputB', false) // compiler must error that null is not assignable to number
        // .connectObservable(st => st.getEventStream(myEvent), 'inputD', false) // compiler must error that number is not assignable to string
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
