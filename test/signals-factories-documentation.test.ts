import { combineLatest, merge, of } from 'rxjs';
import { map, mapTo } from 'rxjs/operators';
import { Store } from '../src/store';
import { getIdentifier, TypeIdentifier } from '../src/store.utils';
import { EffectType, getEffectSignalsFactory } from './../src/effect-signals-factory';
import { createSignalsFactory, Signals, SignalsFactory } from './../src/signals-factory';
import { expectSequence } from './test.utils';

describe('signals factories documentation', () => {
  let store: Store;
  beforeEach(() => {
    store = new Store();
  });

  describe('counter sum documentation', () => {
    type CounterSignalIds = Readonly<{
      counterState: TypeIdentifier<number>;
      increaseEvent: TypeIdentifier<number>;
      decreaseEvent: TypeIdentifier<number>;
    }>;
    type SumSignalIds = Readonly<{
      counterSum: TypeIdentifier<number>;
    }>;
    type SumSignalIds2 = Readonly<{
      inputA: TypeIdentifier<number>;
      inputB: TypeIdentifier<number>;
      counterSum: TypeIdentifier<number>;
    }>;
    type CounterWithSumSignalIds = Readonly<{
      c1Ids: CounterSignalIds;
      c2Ids: CounterSignalIds;
      counterSum: TypeIdentifier<number>;
    }>;

    const getCounterSignals: () => Signals<CounterSignalIds> = () => {
      const counterState = getIdentifier<number>();
      const increaseEvent = getIdentifier<number>();
      const decreaseEvent = getIdentifier<number>();
      return {
        ids: {
          counterState,
          increaseEvent,
          decreaseEvent,
        },
        setup: store => {
          store.addReducer(counterState, increaseEvent, (state, event) => state + event);
          store.addReducer(counterState, decreaseEvent, (state, event) => state - event);
          store.addState(counterState, 0);
        },
      };
    };

    const getSumSignals: (
      aId: TypeIdentifier<number>,
      bId: TypeIdentifier<number>,
    ) => Signals<SumSignalIds> = (aId, bId) => {
      const counterSum = getIdentifier<number>();
      return {
        ids: { counterSum },
        setup: store => {
          store.addLazyBehavior(
            counterSum,
            combineLatest([store.getBehavior(aId), store.getBehavior(bId)]).pipe(
              map(([a, b]) => a + b),
            ),
          );
        },
      };
    };

    const getSumSignals2: () => Signals<SumSignalIds2> = () => {
      const inputA = getIdentifier<number>();
      const inputB = getIdentifier<number>();
      const counterSum = getIdentifier<number>();
      return {
        ids: { counterSum, inputA, inputB },
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
      const counterFactory = createSignalsFactory(getCounterSignals);
      const { ids, setup } = counterFactory.build();
      setup(store);

      const sequence = expectSequence(store.getBehavior(ids.counterState), [0, 1, 6, 4]);
      store.dispatchEvent(ids.increaseEvent, 1);
      store.dispatchEvent(ids.increaseEvent, 5);
      store.dispatchEvent(ids.decreaseEvent, 2);

      await sequence;
    });

    it('should manually compose Signals without SignalsFactory', async () => {
      const getCounterWithSumSignals: () => Signals<CounterWithSumSignalIds> = () => {
        const counter1Signals = getCounterSignals();
        const counter2Signals = getCounterSignals();
        const counterSumSignals = getSumSignals(
          counter1Signals.ids.counterState,
          counter2Signals.ids.counterState,
        );
        return {
          ids: {
            c1Ids: counter1Signals.ids,
            c2Ids: counter2Signals.ids,
            counterSum: counterSumSignals.ids.counterSum,
          },
          setup: store => {
            counter1Signals.setup(store);
            counter2Signals.setup(store);
            counterSumSignals.setup(store);
          },
        };
      };

      const { ids, setup } = getCounterWithSumSignals();
      setup(store);

      const sequence = expectSequence(store.getBehavior(ids.counterSum), [0, 1, 6, 8, 5]);
      store.dispatchEvent(ids.c1Ids.increaseEvent, 1);
      store.dispatchEvent(ids.c1Ids.increaseEvent, 5);
      store.dispatchEvent(ids.c2Ids.increaseEvent, 2);
      store.dispatchEvent(ids.c1Ids.decreaseEvent, 3);

      await sequence;
    });

    it('should manually compose Signals without SignalsFactory2', async () => {
      const getCounterWithSumSignals: () => Signals<CounterWithSumSignalIds> = () => {
        const counter1Signals = getCounterSignals();
        const counter2Signals = getCounterSignals();
        const counterSumSignals = getSumSignals2();
        return {
          ids: {
            c1Ids: counter1Signals.ids,
            c2Ids: counter2Signals.ids,
            counterSum: counterSumSignals.ids.counterSum,
          },
          setup: store => {
            counter1Signals.setup(store);
            counter2Signals.setup(store);
            counterSumSignals.setup(store);
            store.addLazyBehavior(
              counterSumSignals.ids.inputA,
              store.getBehavior(counter1Signals.ids.counterState),
            );
            store.addLazyBehavior(
              counterSumSignals.ids.inputB,
              store.getBehavior(counter2Signals.ids.counterState),
            );
          },
        };
      };

      const { ids, setup } = getCounterWithSumSignals();
      setup(store);

      const sequence = expectSequence(store.getBehavior(ids.counterSum), [0, 1, 6, 8, 5]);
      store.dispatchEvent(ids.c1Ids.increaseEvent, 1);
      store.dispatchEvent(ids.c1Ids.increaseEvent, 5);
      store.dispatchEvent(ids.c2Ids.increaseEvent, 2);
      store.dispatchEvent(ids.c1Ids.decreaseEvent, 3);

      await sequence;
    });

    it('should compose', async () => {
      const counterFactory = createSignalsFactory(getCounterSignals);
      const getSumSignalsFactory = (aId: TypeIdentifier<number>, bId: TypeIdentifier<number>) =>
        createSignalsFactory(() => getSumSignals(aId, bId));

      const getCounterWithSumSignalsFactory: SignalsFactory<CounterWithSumSignalIds> =
        counterFactory
          .bind(() => counterFactory)
          .bind(s => getSumSignalsFactory(s.ids.ids1.counterState, s.ids.ids2.counterState))
          .idsMap(ids => ({
            c1Ids: { ...ids.ids1.ids1 },
            c2Ids: { ...ids.ids1.ids2 },
            counterSum: ids.ids2.counterSum,
          }));

      const { ids, setup } = getCounterWithSumSignalsFactory.build();
      setup(store);

      const sequence = expectSequence(store.getBehavior(ids.counterSum), [0, 1, 6, 8, 5]);
      store.dispatchEvent(ids.c1Ids.increaseEvent, 1);
      store.dispatchEvent(ids.c1Ids.increaseEvent, 5);
      store.dispatchEvent(ids.c2Ids.increaseEvent, 2);
      store.dispatchEvent(ids.c1Ids.decreaseEvent, 3);

      await sequence;
    });
  });

  describe('generic query documentation', () => {
    type ModelIds<T> = Readonly<{
      model: TypeIdentifier<T>;
      setModelEvent: TypeIdentifier<T>;
      updateModelEvent: TypeIdentifier<Partial<T>>;
      resetModelEvent: TypeIdentifier<void>;
    }>;
    const getModelSignals = <T>(defaultModel: T): Signals<ModelIds<T>> => {
      const model = getIdentifier<T>('FilterModel');
      const setModelEvent = getIdentifier<T>();
      const updateModelEvent = getIdentifier<Partial<T>>();
      const resetModelEvent = getIdentifier<void>();
      return {
        ids: {
          model,
          setModelEvent,
          updateModelEvent,
          resetModelEvent,
        },
        setup: store => {
          store.addState(model, defaultModel);
          store.addReducer(model, setModelEvent, (_, event) => event);
          store.addReducer(model, updateModelEvent, (state, event) => ({
            ...state,
            ...event,
          }));
          store.addReducer(model, resetModelEvent, () => defaultModel);
        },
      };
    };
    const getModelSignalsFactory = <T>(defaultModel: T) =>
      createSignalsFactory(() => getModelSignals(defaultModel));

    type SortParameter = Readonly<{ propertyName?: string; descending: boolean }>;
    type SortingIds = Readonly<{
      sorting: TypeIdentifier<SortParameter>;
      ascendingEvent: TypeIdentifier<string>;
      descendingEvent: TypeIdentifier<string>;
      noneEvent: TypeIdentifier<void>;
    }>;
    const getSortingSignals = (): Signals<SortingIds> => {
      const sorting = getIdentifier<SortParameter>();
      const ascendingEvent = getIdentifier<string>();
      const descendingEvent = getIdentifier<string>();
      const noneEvent = getIdentifier<void>();
      return {
        ids: {
          sorting,
          ascendingEvent,
          descendingEvent,
          noneEvent,
        },
        setup: store => {
          store.addState(sorting, { descending: false });
          store.addReducer(sorting, ascendingEvent, (_, propertyName) => ({
            propertyName,
            descending: false,
          }));
          store.addReducer(sorting, descendingEvent, (_, propertyName) => ({
            propertyName,
            descending: true,
          }));
          store.addReducer(sorting, noneEvent, () => ({ descending: false }));
        },
      };
    };
    const sortingSignalsFactory = createSignalsFactory(getSortingSignals);

    type PagingParameter = Readonly<{ page: number; pageSize: number }>;
    type PagingIds = Readonly<{
      paging: TypeIdentifier<PagingParameter>;
      setPageEvent: TypeIdentifier<number>;
      setPageSizeEvent: TypeIdentifier<number>;
    }>;
    const getPagingSignals = (): Signals<PagingIds> => {
      const paging = getIdentifier<PagingParameter>();
      const setPageEvent = getIdentifier<number>();
      const setPageSizeEvent = getIdentifier<number>();
      return {
        ids: {
          paging,
          setPageEvent,
          setPageSizeEvent,
        },
        setup: store => {
          store.addState(paging, { page: 0, pageSize: 10 });
          store.addReducer(paging, setPageEvent, (state, page) => ({
            ...state,
            page,
          }));
          store.addReducer(paging, setPageSizeEvent, (state, pageSize) => ({
            ...state,
            pageSize,
          }));
        },
      };
    };
    const pagingSignalsFactory = createSignalsFactory(getPagingSignals);

    type FilteredSortedPagedQueryIds<FilterType> = ModelIds<FilterType> & SortingIds & PagingIds;
    const getFilteredSortedPagedQuerySignalsFactory = <FilterType>(
      defaultFilter: FilterType,
    ): SignalsFactory<FilteredSortedPagedQueryIds<FilterType>> =>
      getModelSignalsFactory(defaultFilter)
        .bind(() => sortingSignalsFactory)
        .flattenIds()
        .bind(() => pagingSignalsFactory)
        .flattenIds()
        .fmap(s => ({
          ...s,
          setup: store => {
            s.setup(store);
            store.addEventSource(
              Symbol('resetPagingEffect'),
              s.ids.setPageEvent,
              merge(
                store.getEventStream(s.ids.resetModelEvent),
                store.getEventStream(s.ids.setModelEvent),
                store.getEventStream(s.ids.updateModelEvent),
                store.getEventStream(s.ids.ascendingEvent),
                store.getEventStream(s.ids.descendingEvent),
                store.getEventStream(s.ids.noneEvent),
              ).pipe(mapTo(0)),
            );
          },
        }));

    const getQueryWithResultFactory = <FilterType, ResultType>(
      defaultFilter: FilterType,
      queryEffect: EffectType<[FilterType, SortParameter, PagingParameter], ResultType>,
    ) =>
      getFilteredSortedPagedQuerySignalsFactory(defaultFilter)
        .bind(s =>
          getEffectSignalsFactory(
            store =>
              combineLatest([
                store.getBehavior(s.ids.model),
                store.getBehavior(s.ids.sorting),
                store.getBehavior(s.ids.paging),
              ]),
            queryEffect,
          ),
        )
        .flattenIds();

    it('should create the factory', async () => {
      type FT = { name: string };
      const effectMock: EffectType<[FT, SortParameter, PagingParameter], string[]> = input =>
        of([input[0].name]);
      const f = getQueryWithResultFactory({ name: '' }, effectMock).build();
      expect(f.ids.model.toString()).toEqual('Symbol(FilterModel)');
    });
  });
});
