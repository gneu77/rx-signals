import { combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { Store } from '../src/store';
import { Signals, SignalsFactory } from './../src/signals-factory';
import { BehaviorId, EventId, getBehaviorId, getEventId } from './../src/store-utils';
import { expectSequence } from './test.utils';

describe('signals factories documentation', () => {
  let store: Store;
  beforeEach(() => {
    store = new Store();
  });

  describe('counter sum documentation', () => {
    type CounterInput = Readonly<{
      increaseBy: EventId<number>;
      decreaseBy: EventId<number>;
    }>;
    type CounterOutput = Readonly<{
      counterState: BehaviorId<number>;
    }>;
    type SumInput = Readonly<{
      inputA: BehaviorId<number>;
      inputB: BehaviorId<number>;
    }>;
    type SumOutput = Readonly<{
      counterSum: BehaviorId<number>;
    }>;
    type ComposedInput = Readonly<{
      inputA: CounterInput;
      inputB: CounterInput;
    }>;

    const getCounterSignals: () => Signals<CounterInput, CounterOutput> = () => {
      const counterState = getBehaviorId<number>();
      const increaseBy = getEventId<number>();
      const decreaseBy = getEventId<number>();
      return {
        input: {
          increaseBy,
          decreaseBy,
        },
        output: {
          counterState,
        },
        setup: store => {
          store.addReducer(counterState, increaseBy, (state, event) => state + event);
          store.addReducer(counterState, decreaseBy, (state, event) => state - event);
          store.addState(counterState, 0);
        },
      };
    };

    const getSumSignals: (
      inputA: BehaviorId<number>,
      inputB: BehaviorId<number>,
    ) => Signals<{}, SumOutput> = (inputA, inputB) => {
      const counterSum = getBehaviorId<number>();
      return {
        input: {},
        output: { counterSum },
        setup: store => {
          store.addLazyBehavior(
            counterSum,
            combineLatest([store.getBehavior(inputA), store.getBehavior(inputB)]).pipe(
              map(([a, b]) => a + b),
            ),
          );
        },
      };
    };

    const getSumSignals2: () => Signals<SumInput, SumOutput> = () => {
      const inputA = getBehaviorId<number>();
      const inputB = getBehaviorId<number>();
      const counterSum = getBehaviorId<number>();
      return {
        input: { inputA, inputB },
        output: { counterSum },
        setup: store => {
          store.addLazyBehavior(
            counterSum,
            combineLatest([store.getBehavior(inputA), store.getBehavior(inputB)]).pipe(
              map(([a, b]) => a + b),
            ),
          );
        },
      };
    };

    it('should createSignalsFactory for counters', async () => {
      const counterFactory = new SignalsFactory(getCounterSignals);
      const { input, output, setup } = counterFactory.build({});
      setup(store);

      const sequence = expectSequence(store.getBehavior(output.counterState), [0, 1, 6, 4]);
      store.dispatch(input.increaseBy, 1);
      store.dispatch(input.increaseBy, 5);
      store.dispatch(input.decreaseBy, 2);

      await sequence;
    });

    it('should manually compose Signals without SignalsFactory', async () => {
      const getCounterWithSumSignals: () => Signals<ComposedInput, SumOutput> = () => {
        const counter1Signals = getCounterSignals();
        const counter2Signals = getCounterSignals();
        const counterSumSignals = getSumSignals(
          counter1Signals.output.counterState,
          counter2Signals.output.counterState,
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

    it('should manually compose Signals without SignalsFactory 2', async () => {
      const getCounterWithSumSignals: () => Signals<ComposedInput, SumOutput> = () => {
        const counter1Signals = getCounterSignals();
        const counter2Signals = getCounterSignals();
        const counterSumSignals = getSumSignals2();
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
            store.addLazyBehavior(
              counterSumSignals.input.inputA,
              store.getBehavior(counter1Signals.output.counterState),
            );
            store.addLazyBehavior(
              counterSumSignals.input.inputB,
              store.getBehavior(counter2Signals.output.counterState),
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
      const sumFactory = new SignalsFactory(getSumSignals2);
      const getCounterWithSumSignalsFactory: SignalsFactory<ComposedInput, SumOutput> =
        counterFactory
          .bind(() => counterFactory)
          .bind(() => sumFactory)
          .extendSetup((store, input, output) => {
            store.connect(output.conflicts1.counterState, input.inputA);
            store.connect(output.conflicts2.counterState, input.inputB);
          })
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

  // describe('generic query documentation', () => {
  //   type ModelIds<T> = Readonly<{
  //     model: TypeIdentifier<T>;
  //     setModelEvent: TypeIdentifier<T>;
  //     updateModelEvent: TypeIdentifier<Partial<T>>;
  //     resetModelEvent: TypeIdentifier<void>;
  //   }>;
  //   const getModelSignals = <T>(defaultModel: T): Signals<ModelIds<T>> => {
  //     const model = getIdentifier<T>('FilterModel');
  //     const setModelEvent = getIdentifier<T>();
  //     const updateModelEvent = getIdentifier<Partial<T>>();
  //     const resetModelEvent = getIdentifier<void>();
  //     return {
  //       ids: {
  //         model,
  //         setModelEvent,
  //         updateModelEvent,
  //         resetModelEvent,
  //       },
  //       setup: store => {
  //         store.addState(model, defaultModel);
  //         store.addReducer(model, setModelEvent, (_, event) => event);
  //         store.addReducer(model, updateModelEvent, (state, event) => ({
  //           ...state,
  //           ...event,
  //         }));
  //         store.addReducer(model, resetModelEvent, () => defaultModel);
  //       },
  //     };
  //   };
  //   const getModelSignalsFactory = <T>(defaultModel: T) =>
  //     createSignalsFactory(() => getModelSignals(defaultModel));

  //   type SortParameter = Readonly<{ propertyName?: string; descending: boolean }>;
  //   type SortingIds = Readonly<{
  //     sorting: TypeIdentifier<SortParameter>;
  //     ascendingEvent: TypeIdentifier<string>;
  //     descendingEvent: TypeIdentifier<string>;
  //     noneEvent: TypeIdentifier<void>;
  //   }>;
  //   const getSortingSignals = (): Signals<SortingIds> => {
  //     const sorting = getIdentifier<SortParameter>();
  //     const ascendingEvent = getIdentifier<string>();
  //     const descendingEvent = getIdentifier<string>();
  //     const noneEvent = getIdentifier<void>();
  //     return {
  //       ids: {
  //         sorting,
  //         ascendingEvent,
  //         descendingEvent,
  //         noneEvent,
  //       },
  //       setup: store => {
  //         store.addState(sorting, { descending: false });
  //         store.addReducer(sorting, ascendingEvent, (_, propertyName) => ({
  //           propertyName,
  //           descending: false,
  //         }));
  //         store.addReducer(sorting, descendingEvent, (_, propertyName) => ({
  //           propertyName,
  //           descending: true,
  //         }));
  //         store.addReducer(sorting, noneEvent, () => ({ descending: false }));
  //       },
  //     };
  //   };
  //   const sortingSignalsFactory = createSignalsFactory(getSortingSignals);

  //   type PagingParameter = Readonly<{ page: number; pageSize: number }>;
  //   type PagingIds = Readonly<{
  //     paging: TypeIdentifier<PagingParameter>;
  //     setPageEvent: TypeIdentifier<number>;
  //     setPageSizeEvent: TypeIdentifier<number>;
  //   }>;
  //   const getPagingSignals = (): Signals<PagingIds> => {
  //     const paging = getIdentifier<PagingParameter>();
  //     const setPageEvent = getIdentifier<number>();
  //     const setPageSizeEvent = getIdentifier<number>();
  //     return {
  //       ids: {
  //         paging,
  //         setPageEvent,
  //         setPageSizeEvent,
  //       },
  //       setup: store => {
  //         store.addState(paging, { page: 0, pageSize: 10 });
  //         store.addReducer(paging, setPageEvent, (state, page) => ({
  //           ...state,
  //           page,
  //         }));
  //         store.addReducer(paging, setPageSizeEvent, (state, pageSize) => ({
  //           ...state,
  //           pageSize,
  //         }));
  //       },
  //     };
  //   };
  //   const pagingSignalsFactory = createSignalsFactory(getPagingSignals);

  //   type FilteredSortedPagedQueryIds<FilterType> = ModelIds<FilterType> & SortingIds & PagingIds;
  //   const getFilteredSortedPagedQuerySignalsFactory = <FilterType>(
  //     defaultFilter: FilterType,
  //   ): SignalsFactory<FilteredSortedPagedQueryIds<FilterType>> =>
  //     getModelSignalsFactory(defaultFilter)
  //       .bind(() => sortingSignalsFactory)
  //       .flattenIds()
  //       .bind(() => pagingSignalsFactory)
  //       .flattenIds()
  //       .fmap(s => ({
  //         ...s,
  //         setup: store => {
  //           s.setup(store);
  //           store.addEventSource(
  //             Symbol('resetPagingEffect'),
  //             s.ids.setPageEvent,
  //             merge(
  //               store.getEventStream(s.ids.resetModelEvent),
  //               store.getEventStream(s.ids.setModelEvent),
  //               store.getEventStream(s.ids.updateModelEvent),
  //               store.getEventStream(s.ids.ascendingEvent),
  //               store.getEventStream(s.ids.descendingEvent),
  //               store.getEventStream(s.ids.noneEvent),
  //             ).pipe(mapTo(0)),
  //           );
  //         },
  //       }));

  //   const getQueryWithResultFactory = <FilterType, ResultType>(
  //     defaultFilter: FilterType,
  //     queryEffect: EffectType<[FilterType, SortParameter, PagingParameter], ResultType>,
  //   ) =>
  //     getFilteredSortedPagedQuerySignalsFactory(defaultFilter)
  //       .bind(s =>
  //         getEffectSignalsFactory(
  //           store =>
  //             combineLatest([
  //               store.getBehavior(s.ids.model),
  //               store.getBehavior(s.ids.sorting),
  //               store.getBehavior(s.ids.paging),
  //             ]),
  //           queryEffect,
  //         ),
  //       )
  //       .flattenIds();

  //   it('should create the factory', async () => {
  //     type FT = { name: string };
  //     const effectMock: EffectType<[FT, SortParameter, PagingParameter], string[]> = input =>
  //       of([input[0].name]);
  //     const f = getQueryWithResultFactory({ name: '' }, effectMock).build();
  //     expect(f.ids.model.toString()).toEqual('Symbol(FilterModel)');
  //   });
  // });
});
