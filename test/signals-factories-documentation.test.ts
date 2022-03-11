import { combineLatest, merge, of } from 'rxjs';
import { map, mapTo } from 'rxjs/operators';
import { Effect, Store } from '../src/store';
import { getEffectSignalsFactory } from './../src/effect-signals-factory';
import { Signals, SignalsFactory } from './../src/signals-factory';
import {
  BehaviorId,
  EffectId,
  EventId,
  getBehaviorId,
  getEffectId,
  getEventId,
} from './../src/store-utils';
import { expectSequence } from './test.utils';

describe('signals factories documentation', () => {
  let store: Store;
  beforeEach(() => {
    store = new Store();
  });

  describe('counter sum documentation', () => {
    type CounterInput = {
      increaseBy: EventId<number>;
      decreaseBy: EventId<number>;
    };
    type CounterOutput = {
      counter: BehaviorId<number>;
    };
    const getCounterSignals: () => Signals<CounterInput, CounterOutput> = () => {
      const counter = getBehaviorId<number>();
      const increaseBy = getEventId<number>();
      const decreaseBy = getEventId<number>();
      return {
        input: {
          increaseBy,
          decreaseBy,
        },
        output: {
          counter,
        },
        setup: store => {
          store.addReducer(counter, increaseBy, (state, event) => state + event);
          store.addReducer(counter, decreaseBy, (state, event) => state - event);
          store.addState(counter, 0);
        },
      };
    };

    type SumInput = {
      inputA: BehaviorId<number>;
      inputB: BehaviorId<number>;
    };
    type SumOutput = {
      counterSum: BehaviorId<number>;
    };
    const getSumSignalsBad: (
      inputA: BehaviorId<number>,
      inputB: BehaviorId<number>,
    ) => Signals<{}, SumOutput> = (inputA, inputB) => {
      const counterSum = getBehaviorId<number>();
      return {
        input: {},
        output: { counterSum },
        setup: store => {
          store.addDerivedState(
            counterSum,
            combineLatest([store.getBehavior(inputA), store.getBehavior(inputB)]).pipe(
              map(([a, b]) => a + b),
            ),
          );
        },
      };
    };

    const getSumSignals: () => Signals<SumInput, SumOutput> = () => {
      const inputA = getBehaviorId<number>();
      const inputB = getBehaviorId<number>();
      const counterSum = getBehaviorId<number>();
      return {
        input: { inputA, inputB },
        output: { counterSum },
        setup: store => {
          store.addDerivedState(
            counterSum,
            combineLatest([store.getBehavior(inputA), store.getBehavior(inputB)]).pipe(
              map(([a, b]) => a + b),
            ),
          );
        },
      };
    };

    type ComposedInput = {
      inputA: CounterInput;
      inputB: CounterInput;
    };

    it('should createSignalsFactory for counters', async () => {
      const counterFactory = new SignalsFactory(getCounterSignals);
      const { input, output, setup } = counterFactory.build({});
      setup(store);

      const sequence = expectSequence(store.getBehavior(output.counter), [0, 1, 6, 4]);
      store.dispatch(input.increaseBy, 1);
      store.dispatch(input.increaseBy, 5);
      store.dispatch(input.decreaseBy, 2);

      await sequence;
    });

    it('should manually compose Signals without SignalsFactory Bad', async () => {
      const getCounterWithSumSignals: () => Signals<ComposedInput, SumOutput> = () => {
        const counter1Signals = getCounterSignals();
        const counter2Signals = getCounterSignals();
        const counterSumSignals = getSumSignalsBad(
          counter1Signals.output.counter,
          counter2Signals.output.counter,
        );
        return {
          input: {
            inputA: counter1Signals.input,
            inputB: counter2Signals.input,
          },
          output: {
            counterSum: counterSumSignals.output.counterSum,
          },
          setup: store => {
            counter1Signals.setup(store);
            counter2Signals.setup(store);
            counterSumSignals.setup(store);
          },
        };
      };

      const { input, output, setup } = getCounterWithSumSignals();
      setup(store);

      const sequence = expectSequence(store.getBehavior(output.counterSum), [0, 1, 6, 8, 5]);
      store.dispatch(input.inputA.increaseBy, 1);
      store.dispatch(input.inputA.increaseBy, 5);
      store.dispatch(input.inputB.increaseBy, 2);
      store.dispatch(input.inputA.decreaseBy, 3);

      await sequence;
    });

    it('should manually compose Signals without SignalsFactory Better', async () => {
      const getCounterWithSumSignals: () => Signals<ComposedInput, SumOutput> = () => {
        const counterASignals = getCounterSignals();
        const counterBSignals = getCounterSignals();
        const counterSumSignals = getSumSignals();
        return {
          input: {
            inputA: counterASignals.input,
            inputB: counterBSignals.input,
          },
          output: {
            counterSum: counterSumSignals.output.counterSum,
          },
          setup: store => {
            counterASignals.setup(store);
            counterBSignals.setup(store);
            counterSumSignals.setup(store);
            store.connect(counterASignals.output.counter, counterSumSignals.input.inputA);
            store.connect(counterBSignals.output.counter, counterSumSignals.input.inputB);
          },
        };
      };

      const { input, output, setup } = getCounterWithSumSignals();
      setup(store);

      const sequence = expectSequence(store.getBehavior(output.counterSum), [0, 1, 6, 8, 5]);
      store.dispatch(input.inputA.increaseBy, 1);
      store.dispatch(input.inputA.increaseBy, 5);
      store.dispatch(input.inputB.increaseBy, 2);
      store.dispatch(input.inputA.decreaseBy, 3);

      await sequence;
    });

    it('should manually compose Signals without SignalsFactory', async () => {
      const getCounterWithSumSignals: () => Signals<ComposedInput, SumOutput> = () => {
        const counter1Signals = getCounterSignals();
        const counter2Signals = getCounterSignals();
        const counterSumSignals = getSumSignals();
        return {
          input: {
            inputA: counter1Signals.input,
            inputB: counter2Signals.input,
          },
          output: {
            counterSum: counterSumSignals.output.counterSum,
          },
          setup: store => {
            counter1Signals.setup(store);
            counter2Signals.setup(store);
            counterSumSignals.setup(store);
            store.addDerivedState(
              counterSumSignals.input.inputA,
              store.getBehavior(counter1Signals.output.counter),
            );
            store.addDerivedState(
              counterSumSignals.input.inputB,
              store.getBehavior(counter2Signals.output.counter),
            );
          },
        };
      };

      const { input, output, setup } = getCounterWithSumSignals();
      setup(store);

      const sequence = expectSequence(store.getBehavior(output.counterSum), [0, 1, 6, 8, 5]);
      store.dispatch(input.inputA.increaseBy, 1);
      store.dispatch(input.inputA.increaseBy, 5);
      store.dispatch(input.inputB.increaseBy, 2);
      store.dispatch(input.inputA.decreaseBy, 3);

      await sequence;
    });

    it('should compose', async () => {
      const counterFactory = new SignalsFactory(getCounterSignals);
      const sumFactory = new SignalsFactory(getSumSignals);
      const getCounterWithSumSignalsFactory: SignalsFactory<ComposedInput, SumOutput> =
        counterFactory
          .compose(counterFactory)
          .compose(sumFactory)
          .extendSetup((store, input, output) => {
            store.connect(output.conflicts1.counter, input.inputA);
          })
          .connectObservable(
            (store, output) => store.getBehavior(output.conflicts2.counter),
            'inputB',
            false,
            true,
          )
          .mapInput(ids => ({
            inputA: ids.conflicts1,
            inputB: ids.conflicts2,
          }))
          .mapOutput(ids => ({
            counterSum: ids.counterSum,
          }));

      const { input, output, setup } = getCounterWithSumSignalsFactory.build({});
      setup(store);

      const sequence = expectSequence(store.getBehavior(output.counterSum), [0, 1, 6, 8, 5]);
      store.dispatch(input.inputA.increaseBy, 1);
      store.dispatch(input.inputA.increaseBy, 5);
      store.dispatch(input.inputB.increaseBy, 2);
      store.dispatch(input.inputA.decreaseBy, 3);

      await sequence;
    });
  });

  describe('generic query documentation', () => {
    type ModelInput<T> = {
      setModel: EventId<T>;
      updateModel: EventId<Partial<T>>;
      resetModel: EventId<void>;
    };
    type ModelOutput<T> = {
      model: BehaviorId<T>;
    };
    type ModelConfig<T> = {
      defaultModel: T;
    };
    const getModelSignals = <T>(config: ModelConfig<T>): Signals<ModelInput<T>, ModelOutput<T>> => {
      const model = getBehaviorId<T>();
      const setModel = getEventId<T>();
      const updateModel = getEventId<Partial<T>>();
      const resetModel = getEventId<void>();
      return {
        input: {
          setModel,
          updateModel,
          resetModel,
        },
        output: {
          model,
        },
        setup: store => {
          store.addState(model, config.defaultModel);
          store.addReducer(model, setModel, (_, event) => event);
          store.addReducer(model, updateModel, (state, event) => ({
            ...state,
            ...event,
          }));
          store.addReducer(model, resetModel, () => config.defaultModel);
        },
      };
    };

    type SortParameter = { propertyName?: string; descending: boolean };
    type SortingInput = {
      ascending: EventId<string>;
      descending: EventId<string>;
      none: EventId<void>;
    };
    type SortingOutput = {
      sorting: BehaviorId<SortParameter>;
    };
    const getSortingSignals = (): Signals<SortingInput, SortingOutput> => {
      const sorting = getBehaviorId<SortParameter>();
      const ascending = getEventId<string>();
      const descending = getEventId<string>();
      const none = getEventId<void>();
      return {
        input: {
          ascending,
          descending,
          none,
        },
        output: {
          sorting,
        },
        setup: store => {
          store.addState(sorting, { descending: false });
          store.addReducer(sorting, ascending, (_, propertyName) => ({
            propertyName,
            descending: false,
          }));
          store.addReducer(sorting, descending, (_, propertyName) => ({
            propertyName,
            descending: true,
          }));
          store.addReducer(sorting, none, () => ({ descending: false }));
        },
      };
    };
    const sortingSignalsFactory = new SignalsFactory(getSortingSignals);

    type PagingParameter = { page: number; pageSize: number };
    type PagingInput = {
      setPage: EventId<number>;
      setPageSize: EventId<number>;
    };
    type PagingOutput = {
      paging: BehaviorId<PagingParameter>;
    };
    const getPagingSignals = (): Signals<PagingInput, PagingOutput> => {
      const paging = getBehaviorId<PagingParameter>();
      const setPage = getEventId<number>();
      const setPageSize = getEventId<number>();
      return {
        input: {
          setPage,
          setPageSize,
        },
        output: {
          paging,
        },
        setup: store => {
          store.addState(paging, { page: 0, pageSize: 10 });
          store.addReducer(paging, setPage, (state, page) => ({
            ...state,
            page,
          }));
          store.addReducer(paging, setPageSize, (state, pageSize) => ({
            ...state,
            pageSize,
          }));
        },
      };
    };
    const pagingSignalsFactory = new SignalsFactory(getPagingSignals);

    type FilteredSortedPagedQueryInput<FilterType> = ModelInput<FilterType> &
      SortingInput &
      PagingInput;
    type FilteredSortedPagedQueryOutput<FilterType> = ModelOutput<FilterType> &
      SortingOutput &
      PagingOutput;
    const getFilteredSortedPagedQuerySignalsFactory = <FilterType>(): SignalsFactory<
      FilteredSortedPagedQueryInput<FilterType>,
      FilteredSortedPagedQueryOutput<FilterType>,
      ModelConfig<FilterType>
    > =>
      new SignalsFactory<ModelInput<FilterType>, ModelOutput<FilterType>, ModelConfig<FilterType>>(
        getModelSignals,
      )
        .compose(sortingSignalsFactory)
        .compose(pagingSignalsFactory)
        .extendSetup((store, input) => {
          store.addEventSource(
            input.setPage,
            merge(
              store.getEventStream(input.resetModel),
              store.getEventStream(input.setModel),
              store.getEventStream(input.updateModel),
              store.getEventStream(input.ascending),
              store.getEventStream(input.descending),
              store.getEventStream(input.none),
            ).pipe(mapTo(0)),
          );
        });

    type QueryWithResultConfig<FilterType, ResultType> = {
      defaultFilter: FilterType;
      resultEffectId: EffectId<[FilterType, SortParameter, PagingParameter], ResultType>;
    };
    const getQueryWithResultFactory = <FilterType, ResultType>() =>
      getFilteredSortedPagedQuerySignalsFactory<FilterType>()
        .compose(
          getEffectSignalsFactory<[FilterType, SortParameter, PagingParameter], ResultType>(),
        )
        .connectObservable(
          (store, output) =>
            combineLatest([
              store.getBehavior(output.model),
              store.getBehavior(output.sorting),
              store.getBehavior(output.paging),
            ]),
          'input',
          false,
          true,
        )
        .mapConfig((config: QueryWithResultConfig<FilterType, ResultType>) => ({
          c1: {
            defaultModel: config.defaultFilter,
          },
          c2: {
            effectId: config.resultEffectId,
          },
        }));

    it('should create the factory', async () => {
      type MyFilter = { firstName: string; lastName: string };
      const resultEffectId = getEffectId<[MyFilter, SortParameter, PagingParameter], string[]>();
      const effectMock: Effect<[MyFilter, SortParameter, PagingParameter], string[]> = input =>
        of([`${input[0].firstName} ${input[0].lastName}`]);
      store.addEffect(resultEffectId, effectMock);
      const myFactory = getQueryWithResultFactory<MyFilter, string[]>().build({
        defaultFilter: {
          firstName: '',
          lastName: '',
        },
        resultEffectId,
      });

      expect(myFactory.output.model.toString()).toEqual('Symbol(B)');
    });
  });
});
