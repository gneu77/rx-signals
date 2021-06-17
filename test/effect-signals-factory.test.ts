import { combineLatest, Observable, of, Subject } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { NO_VALUE } from '../src/source-observable';
import { Store } from '../src/store';
import { EffectSignalsFactoryResult, EffectType, prepareEffectSignals } from './../src/store.utils';
import { expectSequence, withSubscription } from './test.utils';

describe('prepareEffectSignals', () => {
  interface InputModel {
    readonly searchString: string;
    readonly page: number;
  }

  interface ResultModel {
    readonly results: string[];
    readonly totalResults: number;
  }

  const inputSubject = new Subject<InputModel>();

  const effect: EffectType<InputModel, ResultModel> = (input: InputModel) => {
    if (input.page > 0) {
      return of({
        results: [],
        totalResults: 3,
      }).pipe(delay(10));
    }
    return of({
      results: [
        input.searchString + '_result1',
        input.searchString + '_result2',
        input.searchString + '_result3',
      ],
      totalResults: 3,
    }).pipe(delay(10));
  };

  let factory: EffectSignalsFactoryResult<InputModel, ResultModel>;
  let store: Store;
  let combinedObservable: Observable<{
    result: ResultModel;
    loading: boolean;
  }>;

  beforeEach(() => {
    store = new Store();
  });

  describe('default options', () => {
    beforeEach(() => {
      factory = prepareEffectSignals<InputModel, ResultModel>(inputSubject.asObservable(), effect);
      combinedObservable = combineLatest([
        store.getBehavior(factory.identifiers.resultBehaviorId),
        store.getBehavior(factory.identifiers.isLoadingBehaviorId),
      ]).pipe(
        map(([result, loading]) => ({
          result,
          loading,
        })),
      );
    });

    it('should get results', async () => {
      factory.setup(store);
      const sequence = expectSequence(combinedObservable, [
        {
          result: {
            results: [],
            totalResults: 3,
          },
          loading: true,
        },
        {
          result: {
            results: [],
            totalResults: 3,
          },
          loading: false,
        },
      ]);
      inputSubject.next({
        searchString: 'test',
        page: 2,
      });
      await sequence;
    });

    it('should debounce inputs', async () => {
      factory.setup(store);
      const sequence = expectSequence(combinedObservable, [
        {
          result: {
            results: ['test_result1', 'test_result2', 'test_result3'],
            totalResults: 3,
          },
          loading: true,
        },
        {
          result: {
            results: ['test_result1', 'test_result2', 'test_result3'],
            totalResults: 3,
          },
          loading: false,
        },
      ]);
      inputSubject.next({
        searchString: 'test',
        page: 2,
      }); // debounced
      inputSubject.next({
        searchString: 'test',
        page: 1,
      }); // debounced
      inputSubject.next({
        searchString: 'test',
        page: 0,
      });
      await sequence;
    });

    it('should get all states when awaited', async () => {
      factory.setup(store);
      await withSubscription(combinedObservable, async () => {
        const sequence1 = expectSequence(combinedObservable, [
          {
            result: {
              results: [],
              totalResults: 3,
            },
            loading: true,
          },
          {
            result: {
              results: [],
              totalResults: 3,
            },
            loading: false,
          },
        ]);

        inputSubject.next({
          searchString: 'test',
          page: 2,
        });
        await sequence1;

        const sequence2 = expectSequence(combinedObservable, [
          {
            result: {
              results: [],
              totalResults: 3,
            },
            loading: false,
          },
          {
            result: {
              results: [],
              totalResults: 3,
            },
            loading: true,
          },
          {
            result: {
              results: [],
              totalResults: 3,
            },
            loading: true,
          },
          {
            result: {
              results: [],
              totalResults: 3,
            },
            loading: false,
          },
        ]);

        inputSubject.next({
          searchString: 'test',
          page: 1,
        });
        await sequence2;

        const sequence3 = expectSequence(combinedObservable, [
          {
            result: {
              results: [],
              totalResults: 3,
            },
            loading: false,
          },
          {
            result: {
              results: [],
              totalResults: 3,
            },
            loading: true,
          },
          {
            result: {
              results: ['test_result1', 'test_result2', 'test_result3'],
              totalResults: 3,
            },
            loading: true,
          },
          {
            result: {
              results: ['test_result1', 'test_result2', 'test_result3'],
              totalResults: 3,
            },
            loading: false,
          },
        ]);

        inputSubject.next({
          searchString: 'test',
          page: 0,
        });
        await sequence3;
      });
    });

    it('should not change on reference equals, but on equals input', async () => {
      factory.setup(store);
      const input = {
        searchString: 'test',
        page: 0,
      };
      await withSubscription(combinedObservable, async () => {
        const sequence1 = expectSequence(combinedObservable, [
          {
            result: {
              results: ['test_result1', 'test_result2', 'test_result3'],
              totalResults: 3,
            },
            loading: true,
          },
          {
            result: {
              results: ['test_result1', 'test_result2', 'test_result3'],
              totalResults: 3,
            },
            loading: false,
          },
        ]);

        inputSubject.next(input);
        await sequence1;

        const sequence2 = expectSequence(combinedObservable, [
          {
            result: {
              results: ['test_result1', 'test_result2', 'test_result3'],
              totalResults: 3,
            },
            loading: false,
          },
        ]);
        inputSubject.next(input); // no effect due to distinctUntilChanged input
        await sequence2;

        const sequence3 = expectSequence(combinedObservable, [
          {
            result: {
              results: ['test_result1', 'test_result2', 'test_result3'],
              totalResults: 3,
            },
            loading: false,
          },
          {
            result: {
              results: ['test_result1', 'test_result2', 'test_result3'],
              totalResults: 3,
            },
            loading: true,
          },
          {
            result: {
              results: ['test_result1', 'test_result2', 'test_result3'],
              totalResults: 3,
            },
            loading: true,
          },
          {
            result: {
              results: ['test_result1', 'test_result2', 'test_result3'],
              totalResults: 3,
            },
            loading: false,
          },
        ]);
        inputSubject.next({ ...input }); // default inputEquals will notice this as change, hence trigger the effect effect
        await sequence3;
      });
    });
  });

  describe('custom inputEquals option', () => {
    beforeEach(() => {
      factory = prepareEffectSignals<InputModel, ResultModel>(inputSubject.asObservable(), effect, {
        inputEquals: (prev, next) =>
          prev.searchString === next.searchString && prev.page === next.page,
      });
      combinedObservable = combineLatest([
        store.getBehavior(factory.identifiers.resultBehaviorId),
        store.getBehavior(factory.identifiers.isLoadingBehaviorId),
      ]).pipe(
        map(([result, loading]) => ({
          result,
          loading,
        })),
      );
    });

    it('should not change on custom equal input', async () => {
      factory.setup(store);
      const input = {
        searchString: 'test',
        page: 0,
      };
      await withSubscription(combinedObservable, async () => {
        const sequence1 = expectSequence(combinedObservable, [
          {
            result: {
              results: ['test_result1', 'test_result2', 'test_result3'],
              totalResults: 3,
            },
            loading: true,
          },
          {
            result: {
              results: ['test_result1', 'test_result2', 'test_result3'],
              totalResults: 3,
            },
            loading: false,
          },
        ]);

        inputSubject.next(input);
        await sequence1;

        const sequence2 = expectSequence(combinedObservable, [
          {
            result: {
              results: ['test_result1', 'test_result2', 'test_result3'],
              totalResults: 3,
            },
            loading: false,
          },
        ]);
        inputSubject.next({ ...input }); // new object, but equal with respect to customEquals
        await sequence2;
        await expectSequence(combinedObservable, [
          {
            result: {
              results: ['test_result1', 'test_result2', 'test_result3'],
              totalResults: 3,
            },
            loading: false,
          },
        ]);

        const sequence3 = expectSequence(combinedObservable, [
          {
            result: {
              results: ['test_result1', 'test_result2', 'test_result3'],
              totalResults: 3,
            },
            loading: false,
          },
        ]);
        inputSubject.next({ ...input, searchString: 'changed' }); // not equal with respect to customEquals
        await sequence3;
        await expectSequence(combinedObservable, [
          {
            result: {
              results: ['test_result1', 'test_result2', 'test_result3'],
              totalResults: 3,
            },
            loading: true,
          },
          {
            result: {
              results: ['changed_result1', 'changed_result2', 'changed_result3'],
              totalResults: 3,
            },
            loading: true,
          },
          {
            result: {
              results: ['changed_result1', 'changed_result2', 'changed_result3'],
              totalResults: 3,
            },
            loading: false,
          },
        ]);
      });
    });

    it('should change on invalidate result event', async () => {
      factory.setup(store);
      const input = {
        searchString: 'test',
        page: 0,
      };
      await withSubscription(combinedObservable, async () => {
        const sequence1 = expectSequence(combinedObservable, [
          {
            result: {
              results: ['test_result1', 'test_result2', 'test_result3'],
              totalResults: 3,
            },
            loading: true,
          },
          {
            result: {
              results: ['test_result1', 'test_result2', 'test_result3'],
              totalResults: 3,
            },
            loading: false,
          },
        ]);

        inputSubject.next(input);
        await sequence1;

        const sequence2 = expectSequence(combinedObservable, [
          {
            result: {
              results: ['test_result1', 'test_result2', 'test_result3'],
              totalResults: 3,
            },
            loading: false,
          },
          {
            result: {
              results: ['test_result1', 'test_result2', 'test_result3'],
              totalResults: 3,
            },
            loading: true,
          },
          {
            result: {
              results: ['test_result1', 'test_result2', 'test_result3'],
              totalResults: 3,
            },
            loading: true,
          },
          {
            result: {
              results: ['test_result1', 'test_result2', 'test_result3'],
              totalResults: 3,
            },
            loading: false,
          },
        ]);
        store.dispatchEvent(factory.identifiers.invalidateResultEventId, null);
        await sequence2;
      });
    });
  });

  describe('initial result option', () => {
    beforeEach(() => {
      factory = prepareEffectSignals<InputModel, ResultModel>(inputSubject.asObservable(), effect, {
        initialResult: {
          results: ['a', 'b', 'c', 'd', 'e'],
          totalResults: 5,
        },
      });
      combinedObservable = combineLatest([
        store.getBehavior(factory.identifiers.resultBehaviorId),
        store.getBehavior(factory.identifiers.isLoadingBehaviorId),
      ]).pipe(
        map(([result, loading]) => ({
          result,
          loading,
        })),
      );
    });

    it('should get initial result and following results', async () => {
      factory.setup(store);
      const sequence = expectSequence(combinedObservable, [
        {
          result: {
            results: ['a', 'b', 'c', 'd', 'e'],
            totalResults: 5,
          },
          loading: false,
        },
        {
          result: {
            results: ['a', 'b', 'c', 'd', 'e'],
            totalResults: 5,
          },
          loading: true,
        },
        {
          result: {
            results: [],
            totalResults: 3,
          },
          loading: true,
        },
        {
          result: {
            results: [],
            totalResults: 3,
          },
          loading: false,
        },
      ]);
      inputSubject.next({
        searchString: 'test',
        page: 2,
      });
      await sequence;
    });

    it('should get results with input', async () => {
      factory.setup(store);
      const sequence = expectSequence(store.getBehavior(factory.identifiers.resultWithInputBehaviorId), [
        {
          input: NO_VALUE,
          result: {
            results: ['a', 'b', 'c', 'd', 'e'],
            totalResults: 5,
          },
          nextIsLoading: false,
        },
        {
          input: {
            searchString: 'test',
            page: 2,
          },
          result: {
            results: ['a', 'b', 'c', 'd', 'e'],
            totalResults: 5,
          },
          nextIsLoading: true,
        },
        {
          input: {
            searchString: 'test',
            page: 2,
          },
          result: {
            results: [],
            totalResults: 3,
          },
          nextIsLoading: false,
        },
      ]);
      inputSubject.next({
        searchString: 'test',
        page: 2,
      });
      await sequence;
    });
  });
});
