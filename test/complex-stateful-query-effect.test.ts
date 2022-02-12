import { combineLatest, of } from 'rxjs';
import { filter, map, switchMap, withLatestFrom } from 'rxjs/operators';
import { getBehaviorId, getEventId } from '../src/store-utils';
import { Store } from './../src/store';
import { awaitStringifyEqualState, expectSequence } from './test.utils';
describe('Stateful query pattern', () => {
  interface QueryType {
    firstName: string | null;
    lastName: string | null;
  }

  interface ResultType {
    result: Array<number | QueryType>;
    resultQuery: QueryType | null;
  }

  const queryBehavior = getBehaviorId<QueryType>();
  const resultBehavior = getBehaviorId<ResultType>();
  const loadingBehavior = getBehaviorId<boolean>();
  const queryEvent = getEventId<Partial<QueryType>>();
  const resultEvent = getEventId<ResultType>();
  const resultEffect = Symbol('ResultEffect');

  let store: Store;

  beforeEach((): void => {
    store = new Store();

    store.addBehavior(
      queryBehavior,
      store.getEventStream(queryEvent).pipe(
        withLatestFrom(store.getBehavior(queryBehavior)),
        map(([queryEvent, currentQuery]) => ({
          ...currentQuery,
          ...queryEvent,
        })),
      ),
      false,
      {
        firstName: null,
        lastName: null,
      },
    );

    store.addBehavior(resultBehavior, store.getEventStream(resultEvent), true, {
      result: [],
      resultQuery: null,
    });

    store.addBehavior(
      loadingBehavior,
      combineLatest([store.getBehavior(queryBehavior), store.getBehavior(resultBehavior)]).pipe(
        map(([query, result]) => query !== result.resultQuery),
      ),
      true,
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
    store.addEventSource(resultEffect, resultEvent, eventSource);
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
