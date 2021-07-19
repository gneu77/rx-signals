import { combineLatest, of } from 'rxjs';
import { debounceTime, filter, map, switchMap } from 'rxjs/operators';
import { TypeIdentifier } from '../src/store.utils';
import { Store } from './../src/store';
import { awaitStringifyEqualState, expectSequence } from './test.utils';
describe('Lazy query pattern', () => {
  interface ResultType {
    result: Array<number | string>;
    resultQuery: string | null;
  }

  const queryBehavior: TypeIdentifier<string | null> = { symbol: Symbol('QueryBehavior') };
  const resultBehavior: TypeIdentifier<ResultType> = { symbol: Symbol('ResultBehavior') };
  const loadingBehavior: TypeIdentifier<boolean> = { symbol: Symbol('LoadingBehavior') };
  const queryEvent: TypeIdentifier<string | null> = { symbol: Symbol('QueryEvent') };
  const resultEvent: TypeIdentifier<ResultType> = { symbol: Symbol('ResultEvent') };
  const resultEffect = Symbol('ResultEffect');

  let store: Store;

  beforeEach((): void => {
    store = new Store();

    store.addLazyBehavior(queryBehavior, store.getEventStream(queryEvent), null);

    store.addLazyBehavior(resultBehavior, store.getEventStream(resultEvent), {
      result: [],
      resultQuery: null,
    });

    store.addLazyBehavior(
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
    store.addEventSource(resultEffect, resultEvent, eventSource);
  });

  it('should not subscribe the effect, if the result is not subscribed', async () => {
    expect(store.isSubscribed(resultBehavior)).toBe(false);
    expect(store.isSubscribed(queryBehavior)).toBe(false);

    const dispatchResult = await store.dispatchEvent(queryEvent, 'testQuery');
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

    store.dispatchEvent(queryEvent, 'testQuery');
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
    store.dispatchEvent(queryEvent, 'testQuery');
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

    store.dispatchEvent(queryEvent, 'testQuery1'); // debounced => no effect
    store.dispatchEvent(queryEvent, 'testQuery2');
    await resultSequence;

    expect(store.isSubscribed(resultBehavior)).toBe(false);
    await store.dispatchEvent(queryEvent, 'testQueryWhileUnsubscribed');

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
    store.dispatchEvent(queryEvent, 'testQuery3');

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

    store.dispatchEvent(queryEvent, 'testQuery');
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

    store.dispatchEvent(queryEvent, 'testQuery');
    await resultSequence3;

    store.resetBehaviors();

    await awaitStringifyEqualState(store.getBehavior(resultBehavior), {
      result: [],
      resultQuery: null,
    });
  });
});
