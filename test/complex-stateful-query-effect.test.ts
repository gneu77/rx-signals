import { filter, switchMap, map, withLatestFrom } from 'rxjs/operators';
import { combineLatest, of } from 'rxjs';
import { Store, TypeIdentifier } from './../src/store';
import { awaitStringifyEqualState, expectSequence } from './test.utils';
describe('Lazy query pattern', () => {
  interface QueryType {
    firstName: string | null;
    lastName: string | null;
  }

  interface ResultType {
    result: Array<number | QueryType>;
    resultQuery: QueryType | null;
  }

  const queryBehavior: TypeIdentifier<QueryType> = { symbol: Symbol('QueryBehavior') };
  const resultBehavior: TypeIdentifier<ResultType> = { symbol: Symbol('ResultBehavior') };
  const loadingBehavior: TypeIdentifier<boolean> = { symbol: Symbol('LoadingBehavior') };
  const queryEvent: TypeIdentifier<Partial<QueryType>> = { symbol: Symbol('QueryEvent') };
  const resultEvent: TypeIdentifier<ResultType> = { symbol: Symbol('ResultEvent') };
  const resultEffect = Symbol('ResultEffect');

  let store: Store;

  beforeEach((): void => {
    store = new Store();

    store.addStatefulBehavior(
      queryBehavior,
      store.getEventStream(queryEvent).pipe(
        withLatestFrom(store.getBehavior(queryBehavior)),
        map(([queryEvent, currentQuery]) => ({
          ...currentQuery,
          ...queryEvent,
        })),
      ),
      {
        firstName: null,
        lastName: null,
      },
    );

    store.addStatelessBehavior(resultBehavior, store.getEventStream(resultEvent), {
      result: [],
      resultQuery: null,
    });

    store.addStatelessBehavior(
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
    await store.dispatchEvent(queryEvent, { firstName: 'test' });
    await awaitStringifyEqualState(store.getBehavior(loadingBehavior), false);
    await expectSequence(store.getBehavior(resultBehavior), [
      {
        result: [1, 2, 3, { firstName: 'test', lastName: null }],
        resultQuery: { firstName: 'test', lastName: null },
      },
    ]);
  });

  it('should reset correctly', async () => {
    await store.dispatchEvent(queryEvent, { firstName: 'test' });
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
