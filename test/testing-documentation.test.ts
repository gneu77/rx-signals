import { combineLatest, map, of } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import { getEffectSignalsFactory } from '../src/effect-signals-factory';
import { Store } from '../src/store';
import { BehaviorId, EventId, getBehaviorId, getEventId } from '../src/store-utils';
import { expectSequence } from '../src/test-utils/test-utils';
import { SignalsFactory } from './../src/signals-factory';

describe('testing documentation', () => {
  let store: Store;
  beforeEach(() => {
    store = new Store();
  });

  type CounterInput = {
    inc: EventId<void>;
    dec: EventId<void>;
  };
  type CounterOutput = {
    counter: BehaviorId<number>;
  };
  const counterFactory = new SignalsFactory<CounterInput, CounterOutput>(() => {
    const counter = getBehaviorId<number>();
    const inc = getEventId<void>();
    const dec = getEventId<void>();
    return {
      input: {
        inc,
        dec,
      },
      output: {
        counter,
      },
      effects: {},
      setup: store => {
        store.addState(counter, 0);
        store.addReducer(counter, inc, state => state + 1);
        store.addReducer(counter, dec, state => state - 1);
      },
    };
  });

  type RandomRange = [number, number];

  // const randomNumberEffect: Effect<RandomRange, number> = ([from, to]) =>
  //   of(from + to * Math.random());

  const randomNumberSignals = counterFactory
    .renameOutputId('counter', 'from')
    .compose(counterFactory)
    .renameOutputId('counter', 'to')
    .compose(getEffectSignalsFactory<RandomRange, number>())
    .connectObservable(
      (store, output) =>
        combineLatest([store.getBehavior(output.from), store.getBehavior(output.to)]),
      'input',
      false,
      true,
    )
    .mapInput(input => ({
      incFrom: input.conflicts1.inc,
      decFrom: input.conflicts1.dec,
      incTo: input.conflicts2.inc,
      decTo: input.conflicts2.dec,
    }))
    .build({});

  it('should test the counter factory individually', async () => {
    const { input, output, setup } = counterFactory.renameOutputId('counter', 'to').build({});
    setup(store);

    const sequence = expectSequence(store.getBehavior(output.to), [0, 1, 2, 1]);
    store.dispatch(input.inc, null);
    store.dispatch(input.inc, null);
    store.dispatch(input.dec, null);

    await sequence;
  });

  it('should test composed counter factory', async () => {
    const { input, output, setup } = counterFactory
      .renameOutputId('counter', 'from')
      .compose(counterFactory)
      .renameOutputId('counter', 'to')
      .mapInput(input => ({
        incFrom: input.conflicts1.inc,
        decFrom: input.conflicts1.dec,
        incTo: input.conflicts2.inc,
        decTo: input.conflicts2.dec,
      }))
      .build({});
    setup(store);

    const sequence = expectSequence(store.getBehavior(output.to), [0, 1, 2, 1]);
    store.dispatch(input.incTo, null);
    store.dispatch(input.incTo, null);
    store.dispatch(input.decTo, null);

    await sequence;
  });

  it('should be testable without effect-mock', async () => {
    randomNumberSignals.setup(store);

    const sequence = expectSequence(
      store.getBehavior(randomNumberSignals.output.combined).pipe(map(c => c.currentInput)),
      [
        [0, 0], // initial
        [0, 1], // incTo
        [0, 2], // incTo
        [1, 2], // incFrom
      ],
    );
    store.dispatch(randomNumberSignals.input.incTo, null);
    store.dispatch(randomNumberSignals.input.incTo, null);
    store.dispatch(randomNumberSignals.input.incFrom, null);

    await sequence;
  });

  it('should be testable with effect-mock', async () => {
    randomNumberSignals.setup(store);
    store.addEffect(randomNumberSignals.effects.id, ([from, to]) => of(from + to * 10));

    const sequence = expectSequence(
      store.getBehavior(randomNumberSignals.output.combined).pipe(
        map(c => c.result),
        distinctUntilChanged(),
      ),
      [undefined, 0, 10, 20, 21],
    );
    store.dispatch(randomNumberSignals.input.incTo, null);
    store.dispatch(randomNumberSignals.input.incTo, null);
    store.dispatch(randomNumberSignals.input.incFrom, null);

    await sequence;
  });
});
