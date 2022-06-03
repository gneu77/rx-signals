import { combineLatest, of } from 'rxjs';
import { filter, map, switchMap } from 'rxjs/operators';
import { getDerivedId, getEventId, getStateId } from '../src/store-utils';
import { awaitStringifyEqualState, expectSequence } from '../src/test-utils/test-utils';
import { Store } from './../src/store';
describe('Stateful query pattern', () => {
  type QueryType = {
    firstName: string | null;
    lastName: string | null;
  };

  type ResultType = {
    result: Array<number | QueryType>;
    resultQuery: QueryType | null;
  };

  const queryBehavior = getStateId<QueryType>();
  const resultBehavior = getDerivedId<ResultType>();
  const loadingBehavior = getDerivedId<boolean>();
  const queryEvent = getEventId<Partial<QueryType>>();
  const resultEvent = getEventId<ResultType>();

  let store: Store;

  beforeEach((): void => {
    store = new Store();

    store.addState(queryBehavior, {
      firstName: null,
      lastName: null,
    });
    store.addReducer(queryBehavior, queryEvent, (state, event) => ({
      ...state,
      ...event,
    }));

    store.addDerivedState(resultBehavior, store.getEventStream(resultEvent), {
      result: [],
      resultQuery: null,
    });

    store.addDerivedState(
      loadingBehavior,
      combineLatest([store.getBehavior(queryBehavior), store.getBehavior(resultBehavior)]).pipe(
        map(([query, result]) => query !== result.resultQuery),
      ),
    );

    const eventSource = combineLatest([
      store.getBehavior(queryBehavior),
      store.getBehavior(resultBehavior),
    ]).pipe(
      filter(([query, result]) => query !== result.resultQuery),
      switchMap(([query]) => {
        if (query.firstName === null && query.lastName === null) {
          return of({ result: [], resultQuery: query });
        }
        return of({ result: [1, 2, 3, query], resultQuery: query });
      }),
    );
    store.addEventSource(resultEvent, eventSource);
  });

  it('should automatically subscribe query and result', async () => {
    expect(store.isSubscribed(resultBehavior)).toBe(false);
    expect(store.isSubscribed(queryBehavior)).toBe(true);
  });

  it('should trigger the effect without subscription from outside', async () => {
    await expectSequence(store.getBehavior(loadingBehavior), [true, false]);

    await expectSequence(store.getBehavior(resultBehavior), [
      {
        result: [],
        resultQuery: { firstName: null, lastName: null },
      },
    ]);
  });

  it('should reduce query and trigger effect', async () => {
    await store.dispatch(queryEvent, { firstName: 'test' });
    await awaitStringifyEqualState(store.getBehavior(loadingBehavior), false);
    await expectSequence(store.getBehavior(resultBehavior), [
      {
        result: [1, 2, 3, { firstName: 'test', lastName: null }],
        resultQuery: { firstName: 'test', lastName: null },
      },
    ]);
  });

  it('should reset correctly', async () => {
    await store.dispatch(queryEvent, { firstName: 'test' });
    await awaitStringifyEqualState(store.getBehavior(loadingBehavior), false);
    const resultSequence = expectSequence(store.getBehavior(resultBehavior), [
      {
        result: [1, 2, 3, { firstName: 'test', lastName: null }],
        resultQuery: { firstName: 'test', lastName: null },
      },
      {
        result: [],
        resultQuery: null,
      },
      {
        result: [],
        resultQuery: { firstName: null, lastName: null },
      },
    ]);
    store.resetBehaviors();
    await resultSequence;
  });
});
