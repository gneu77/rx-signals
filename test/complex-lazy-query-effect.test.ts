import { combineLatest, of } from 'rxjs';
import { debounceTime, filter, map, switchMap } from 'rxjs/operators';
import { getDerivedId, getEventId } from '../src/store-utils';
import { awaitStringifyEqualState, expectSequence } from '../src/test-utils/test-utils';
import { Store } from './../src/store';
describe('All lazy query pattern', () => {
  type ResultType = {
    result: Array<number | string | null>;
    resultQuery: string | null;
  };

  const queryBehavior = getDerivedId<string | null>();
  const resultBehavior = getDerivedId<ResultType>();
  const loadingBehavior = getDerivedId<boolean>();
  const queryEvent = getEventId<string | null>();
  const resultEvent = getEventId<ResultType>();

  let store: Store;

  beforeEach((): void => {
    store = new Store();

    store.addDerivedState(queryBehavior, store.getEventStream(queryEvent), null);

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
      debounceTime(100),
      switchMap(([query]) => of({ result: [1, 2, 3, query], resultQuery: query })),
    );
    store.addEventSource(resultEvent, eventSource);
  });

  it('should not subscribe the effect, if the result is not subscribed', async () => {
    expect(store.isSubscribed(resultBehavior)).toBe(false);
    expect(store.isSubscribed(queryBehavior)).toBe(false);

    const dispatchResult = await store.dispatch(queryEvent, 'testQuery');
    expect(dispatchResult).toBe(false);
  });

  it('should fetch results upon subscription', async () => {
    const resultSequence = expectSequence(store.getBehavior(resultBehavior), [
      {
        result: [],
        resultQuery: null,
      },
      {
        result: [1, 2, 3, 'testQuery'],
        resultQuery: 'testQuery',
      },
    ]);
    expect(store.isSubscribed(resultBehavior)).toBe(true);
    expect(store.isSubscribed(queryBehavior)).toBe(true);

    store.dispatch(queryEvent, 'testQuery');
    await resultSequence;
  });

  it('should switch loading state while fetching results', async () => {
    const loadingSequence = expectSequence(store.getBehavior(loadingBehavior), [false]);
    await loadingSequence;

    const loadingSequence2 = expectSequence(store.getBehavior(loadingBehavior), [
      false,
      true,
      false,
    ]);
    store.dispatch(queryEvent, 'testQuery');
    await loadingSequence2;
  });

  it('should debounce', async () => {
    const resultSequence = expectSequence(store.getBehavior(resultBehavior), [
      {
        result: [],
        resultQuery: null,
      },
      {
        result: [1, 2, 3, 'testQuery2'],
        resultQuery: 'testQuery2',
      },
    ]);
    expect(store.isSubscribed(resultBehavior)).toBe(true);
    expect(store.isSubscribed(queryBehavior)).toBe(true);

    store.dispatch(queryEvent, 'testQuery1'); // debounced => no effect
    store.dispatch(queryEvent, 'testQuery2');
    await resultSequence;

    expect(store.isSubscribed(resultBehavior)).toBe(false);
    await store.dispatch(queryEvent, 'testQueryWhileUnsubscribed');

    const resultSequence2 = expectSequence(store.getBehavior(resultBehavior), [
      {
        result: [1, 2, 3, 'testQuery2'],
        resultQuery: 'testQuery2',
      },
      {
        result: [1, 2, 3, 'testQuery3'],
        resultQuery: 'testQuery3',
      },
    ]);
    store.dispatch(queryEvent, 'testQuery3');

    await resultSequence2;
  });

  it('should reset correctly', async () => {
    const resultSequence = expectSequence(store.getBehavior(resultBehavior), [
      {
        result: [],
        resultQuery: null,
      },
      {
        result: [1, 2, 3, 'testQuery'],
        resultQuery: 'testQuery',
      },
    ]);

    store.dispatch(queryEvent, 'testQuery');
    await resultSequence;

    const resultSequence2 = expectSequence(store.getBehavior(resultBehavior), [
      {
        result: [1, 2, 3, 'testQuery'],
        resultQuery: 'testQuery',
      },
      {
        result: [],
        resultQuery: null,
      },
    ]);

    store.resetBehaviors();
    await resultSequence2;

    const resultSequence3 = expectSequence(store.getBehavior(resultBehavior), [
      {
        result: [],
        resultQuery: null,
      },
      {
        result: [1, 2, 3, 'testQuery'],
        resultQuery: 'testQuery',
      },
    ]);

    store.dispatch(queryEvent, 'testQuery');
    await resultSequence3;

    store.resetBehaviors();

    await awaitStringifyEqualState(store.getBehavior(resultBehavior), {
      result: [],
      resultQuery: null,
    });
  });

  describe('examples from documentation', () => {
    it('should work as described in the documentation', async () => {
      type QueryResult = Readonly<{
        result: string[];
        resultQuery: string | null;
      }>;

      const query = getDerivedId<string>();
      const result = getDerivedId<QueryResult>();
      const pending = getDerivedId<boolean>();
      const setQuery = getEventId<string>();
      const setResult = getEventId<QueryResult>();

      store.addDerivedState(query, store.getEventStream(setQuery), '');
      store.addDerivedState(result, store.getEventStream(setResult), {
        result: [],
        resultQuery: null,
      });
      store.addDerivedState(
        pending,
        combineLatest([store.getBehavior(query), store.getBehavior(result)]).pipe(
          map(([q, r]) => q !== r.resultQuery),
        ),
      );
      store.addEventSource(
        setResult,
        combineLatest([store.getBehavior(query), store.getBehavior(result)]).pipe(
          filter(([q, r]) => q !== r.resultQuery),
          debounceTime(100),
          switchMap(([q]) => of({ result: [`mock result for ${q}`], resultQuery: q })),
        ),
      );

      const o = combineLatest([store.getBehavior(result), store.getBehavior(pending)]).pipe(
        map(([r, p]) => ({
          result: r.result,
          pending: p,
        })),
      );
      const resultSequence = expectSequence(o, [
        {
          result: [],
          pending: true,
        },
        {
          result: ['mock result for test'],
          pending: true,
        },
        {
          result: ['mock result for test'],
          pending: false,
        },
      ]);
      store.dispatch(setQuery, 'test');
      await resultSequence;
    });
  });
});
