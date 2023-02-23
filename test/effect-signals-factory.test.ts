import { Observable, Subject, interval, map, of } from 'rxjs';
import { delay, filter, skip, take } from 'rxjs/operators';
import {
  CombinedEffectResult,
  EffectInputSignals,
  EffectOutputSignals,
  EffectSignalsFactory,
  getEffectSignalsFactory,
  isCombinedEffectResultInCompletedSuccessState,
  isCompletedResultEvent,
} from '../src/effect-signals-factory';
import { Effect, Store } from '../src/store';
import { NO_VALUE, getStateId, isNotNoValueType } from '../src/store-utils';
import { expectSequence, withSubscription } from '../src/test-utils/test-utils';
import { effectErrorKind, isNotEffectError } from './../src/effect-result';
import { CombinedEffectResultInSuccessState } from './../src/effect-signals-factory';
import { getEffectId } from './../src/store-utils';

describe('effect signals factory', () => {
  type InputModel = {
    searchString: string;
    page: number;
  };

  type ResultModel = {
    results: string[];
    totalResults: number;
  };

  const inputStateId = getStateId<InputModel>();
  const inputSubject = new Subject<InputModel>();
  let effectCalled = 0;

  const resultEffectId = getEffectId<InputModel, ResultModel, string>('Result Effect');
  const resultEffect: Effect<InputModel, ResultModel, string> = (
    input: InputModel,
    { previousInput, previousResult },
  ) => {
    effectCalled = effectCalled + 1;
    if (input.searchString === 'throw') {
      throw 'unhandled';
    }
    let totalResults = 1;
    if (
      isNotNoValueType(previousInput) &&
      isNotNoValueType(previousResult) &&
      isNotEffectError(previousResult) &&
      previousInput.searchString === 'addToNext'
    ) {
      totalResults += previousResult.totalResults;
    }
    if (input.page > 0) {
      return of({
        results: [],
        totalResults,
      }).pipe(delay(30));
    }
    return of({
      results: [input.searchString + '_result'],
      totalResults,
    }).pipe(delay(30));
  };
  const multiResultEffect: Effect<InputModel, ResultModel, string> = (input: InputModel) => {
    effectCalled = effectCalled + 1;
    return interval(30).pipe(
      take(4),
      map(count => ({
        results: [input.searchString + '_result_' + String(count)],
        totalResults: 1,
      })),
    );
  };

  let store: Store;

  beforeEach(() => {
    effectCalled = 0;
    store = new Store();
    store.addEffect(resultEffectId, resultEffect);
    store.connectObservable(inputSubject.asObservable(), inputStateId);
  });

  describe('multi results effect', () => {
    let outIds: EffectOutputSignals<InputModel, ResultModel, string>;
    let observable: Observable<CombinedEffectResult<InputModel, ResultModel, string>>;

    beforeEach(() => {
      const factoryResult = getEffectSignalsFactory<InputModel, ResultModel, string>()
        .extendSetup(({ store, input }) => store.connect(inputStateId, input.input))
        .build({});
      outIds = factoryResult.output;
      factoryResult.setup(store);
      store.addEffect(factoryResult.effects.id, multiResultEffect);
      observable = store.getBehavior(outIds.combined);
    });

    it('should have correct combined sequence for input', async () => {
      const sequence = expectSequence(observable, [
        {
          currentInput: {
            searchString: 'test',
            page: 2,
          },
          resultPending: true,
          resultInput: NO_VALUE,
          result: NO_VALUE,
        },
        {
          currentInput: {
            searchString: 'test',
            page: 2,
          },
          resultInput: {
            searchString: 'test',
            page: 2,
          },
          result: {
            results: ['test_result_0'],
            totalResults: 1,
          },
          resultPending: true,
        },
        {
          currentInput: {
            searchString: 'test',
            page: 2,
          },
          resultInput: {
            searchString: 'test',
            page: 2,
          },
          result: {
            results: ['test_result_1'],
            totalResults: 1,
          },
          resultPending: true,
        },
        {
          currentInput: {
            searchString: 'test',
            page: 2,
          },
          resultInput: {
            searchString: 'test',
            page: 2,
          },
          result: {
            results: ['test_result_2'],
            totalResults: 1,
          },
          resultPending: true,
        },
        {
          currentInput: {
            searchString: 'test',
            page: 2,
          },
          resultInput: {
            searchString: 'test',
            page: 2,
          },
          result: {
            results: ['test_result_3'],
            totalResults: 1,
          },
          resultPending: true,
        },
        {
          currentInput: {
            searchString: 'test',
            page: 2,
          },
          resultInput: {
            searchString: 'test',
            page: 2,
          },
          result: {
            results: ['test_result_3'],
            totalResults: 1,
          },
          resultPending: false,
        },
      ]);
      inputSubject.next({
        searchString: 'test',
        page: 2,
      });
      await sequence;
    });

    it('should have correct result sequence for input', async () => {
      const sequence = expectSequence(
        store
          .getBehavior(outIds.combined)
          .pipe(filter(isCombinedEffectResultInCompletedSuccessState)),
        [
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            resultInput: {
              searchString: 'test',
              page: 2,
            },
            result: {
              results: ['test_result_3'],
              totalResults: 1,
            },
            resultPending: false,
          },
        ],
      );
      inputSubject.next({
        searchString: 'test',
        page: 2,
      });
      await sequence;
    });

    it('should switch to new effect on new input', async () => {
      const sequence = expectSequence(observable, [
        {
          currentInput: {
            searchString: 'test',
            page: 2,
          },
          resultPending: true,
          resultInput: NO_VALUE,
          result: NO_VALUE,
        },
        {
          currentInput: {
            searchString: 'test',
            page: 2,
          },
          resultInput: {
            searchString: 'test',
            page: 2,
          },
          result: {
            results: ['test_result_0'],
            totalResults: 1,
          },
          resultPending: true,
        },
        {
          currentInput: {
            searchString: 'test',
            page: 2,
          },
          resultInput: {
            searchString: 'test',
            page: 2,
          },
          result: {
            results: ['test_result_1'],
            totalResults: 1,
          },
          resultPending: true,
        },
        {
          currentInput: {
            searchString: 'test2',
            page: 2,
          },
          resultInput: {
            searchString: 'test',
            page: 2,
          },
          result: {
            results: ['test_result_1'],
            totalResults: 1,
          },
          resultPending: true,
        },
        {
          currentInput: {
            searchString: 'test2',
            page: 2,
          },
          resultInput: {
            searchString: 'test2',
            page: 2,
          },
          result: {
            results: ['test2_result_0'],
            totalResults: 1,
          },
          resultPending: true,
        },
        {
          currentInput: {
            searchString: 'test2',
            page: 2,
          },
          resultInput: {
            searchString: 'test2',
            page: 2,
          },
          result: {
            results: ['test2_result_1'],
            totalResults: 1,
          },
          resultPending: true,
        },
        {
          currentInput: {
            searchString: 'test2',
            page: 2,
          },
          resultInput: {
            searchString: 'test2',
            page: 2,
          },
          result: {
            results: ['test2_result_2'],
            totalResults: 1,
          },
          resultPending: true,
        },
        {
          currentInput: {
            searchString: 'test2',
            page: 2,
          },
          resultInput: {
            searchString: 'test2',
            page: 2,
          },
          result: {
            results: ['test2_result_3'],
            totalResults: 1,
          },
          resultPending: true,
        },
        {
          currentInput: {
            searchString: 'test2',
            page: 2,
          },
          resultInput: {
            searchString: 'test2',
            page: 2,
          },
          result: {
            results: ['test2_result_3'],
            totalResults: 1,
          },
          resultPending: false,
        },
      ]);
      observable.pipe(skip(2), take(1)).subscribe(v => {
        expect(v.result).toEqual({
          results: ['test_result_1'],
          totalResults: 1,
        });
        inputSubject.next({
          searchString: 'test2',
          page: 2,
        });
      });
      inputSubject.next({
        searchString: 'test',
        page: 2,
      });
      await sequence;
    });
  });

  describe('getEffectSignalsFactory', () => {
    let factory: EffectSignalsFactory<InputModel, ResultModel, string>;

    beforeEach(() => {
      factory = getEffectSignalsFactory<InputModel, ResultModel, string>().useExistingEffect(
        'id',
        () => resultEffectId,
        true,
      );
    });

    describe('default settings', () => {
      let inIds: EffectInputSignals<InputModel>;
      let outIds: EffectOutputSignals<InputModel, ResultModel, string>;
      let observable: Observable<CombinedEffectResult<InputModel, ResultModel, string>>;
      let resultObservable: Observable<CombinedEffectResultInSuccessState<InputModel, ResultModel>>;

      beforeEach(() => {
        const factoryResult = factory
          .extendSetup(({ store, input }) => store.connect(inputStateId, input.input))
          .build({});
        inIds = factoryResult.input;
        outIds = factoryResult.output;
        factoryResult.setup(store);
        observable = store.getBehavior(outIds.combined);
        resultObservable = store
          .getBehavior(outIds.combined)
          .pipe(filter(isCombinedEffectResultInCompletedSuccessState));
      });

      it('should have correct combined sequence for input', async () => {
        const sequence = expectSequence(observable, [
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            resultPending: true,
            resultInput: NO_VALUE,
            result: NO_VALUE,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            resultInput: {
              searchString: 'test',
              page: 2,
            },
            result: {
              results: [],
              totalResults: 1,
            },
            resultPending: true,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            resultInput: {
              searchString: 'test',
              page: 2,
            },
            result: {
              results: [],
              totalResults: 1,
            },
            resultPending: false,
          },
        ]);
        inputSubject.next({
          searchString: 'test',
          page: 2,
        });
        await sequence;
      });

      it('should have correct result sequence for input', async () => {
        const sequence = expectSequence(resultObservable, [
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            resultInput: {
              searchString: 'test',
              page: 2,
            },
            result: {
              results: [],
              totalResults: 1,
            },
            resultPending: false,
          },
        ]);
        inputSubject.next({
          searchString: 'test',
          page: 2,
        });
        await sequence;
      });

      it('should not debounce the effect', async () => {
        const sequence = expectSequence(observable, [
          {
            currentInput: {
              searchString: 'test',
              page: 4,
            },
            resultPending: true,
            resultInput: NO_VALUE,
            result: NO_VALUE,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 3,
            },
            resultPending: true,
            resultInput: NO_VALUE,
            result: NO_VALUE,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            resultPending: true,
            resultInput: NO_VALUE,
            result: NO_VALUE,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            resultInput: {
              searchString: 'test',
              page: 2,
            },
            result: {
              results: [],
              totalResults: 1,
            },
            resultPending: true,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            resultInput: {
              searchString: 'test',
              page: 2,
            },
            result: {
              results: [],
              totalResults: 1,
            },
            resultPending: false,
          },
        ]);
        inputSubject.next({
          searchString: 'test',
          page: 4,
        });
        inputSubject.next({
          searchString: 'test',
          page: 3,
        });
        inputSubject.next({
          searchString: 'test',
          page: 2,
        });
        await sequence;
        expect(effectCalled).toBe(3);
      });

      it('should handle unhandled effect errors', async () => {
        await withSubscription(observable, async () => {
          const sequence = expectSequence(observable, [
            {
              currentInput: {
                searchString: 'throw',
                page: 2,
              },
              resultPending: true,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            {
              currentInput: {
                searchString: 'throw',
                page: 2,
              },
              resultPending: false,
              resultInput: {
                searchString: 'throw',
                page: 2,
              },
              result: {
                kind: effectErrorKind,
                error: {
                  unhandledError: 'unhandled',
                },
              },
            },
          ]);
          inputSubject.next({
            searchString: 'throw',
            page: 2,
          });
          await sequence;
          const sequence2 = expectSequence(observable, [
            {
              currentInput: {
                searchString: 'throw',
                page: 2,
              },
              resultPending: false,
              resultInput: {
                searchString: 'throw',
                page: 2,
              },
              result: {
                kind: effectErrorKind,
                error: {
                  unhandledError: 'unhandled',
                },
              },
            },
            {
              currentInput: {
                searchString: 'test',
                page: 2,
              },
              resultPending: true,
              resultInput: {
                searchString: 'throw',
                page: 2,
              },
              result: {
                kind: effectErrorKind,
                error: {
                  unhandledError: 'unhandled',
                },
              },
            },
            {
              currentInput: {
                searchString: 'test',
                page: 2,
              },
              resultInput: {
                searchString: 'test',
                page: 2,
              },
              result: {
                results: [],
                totalResults: 1,
              },
              resultPending: true,
            },
            {
              currentInput: {
                searchString: 'test',
                page: 2,
              },
              resultInput: {
                searchString: 'test',
                page: 2,
              },
              result: {
                results: [],
                totalResults: 1,
              },
              resultPending: false,
            },
          ]);
          inputSubject.next({
            searchString: 'test',
            page: 2,
          });
          await sequence2;

          const sequence3 = expectSequence(
            store.getEventStream(outIds.completedResults).pipe(filter(isCompletedResultEvent)),
            [
              {
                resultInput: {
                  searchString: 'throw',
                  page: 2,
                },
                result: {
                  kind: effectErrorKind,
                  error: {
                    unhandledError: 'unhandled',
                  },
                },
                completed: true,
              },
              {
                resultInput: {
                  searchString: 'throw',
                  page: 3,
                },
                result: {
                  kind: effectErrorKind,
                  error: {
                    unhandledError: 'unhandled',
                  },
                },
                completed: true,
              },
            ],
          );
          inputSubject.next({
            searchString: 'throw',
            page: 2,
          });
          inputSubject.next({
            searchString: 'throw',
            page: 3,
          });
          await sequence3;
        });
      });

      it('should not subscribe the effect, if only the result event is subscribed: error case', async () => {
        const sequence3 = expectSequence(store.getEventStream(outIds.completedResults), [
          {
            resultInput: {
              searchString: 'throw',
              page: 4,
            },
            result: {
              kind: effectErrorKind,
              error: {
                unhandledError: 'unhandled',
              },
            },
            completed: true,
          },
        ]);
        expect(store.isSubscribed(outIds.combined)).toBe(false);
        inputSubject.next({
          searchString: 'throw',
          page: 2,
        });
        inputSubject.next({
          searchString: 'throw',
          page: 3,
        });
        inputSubject.next({
          searchString: 'throw',
          page: 4,
        });
        const sequence = expectSequence(observable, [
          {
            currentInput: {
              searchString: 'throw',
              page: 4,
            },
            resultPending: true,
            resultInput: NO_VALUE,
            result: NO_VALUE,
          },
          {
            currentInput: {
              searchString: 'throw',
              page: 4,
            },
            resultPending: false,
            resultInput: {
              searchString: 'throw',
              page: 4,
            },
            result: {
              kind: effectErrorKind,
              error: {
                unhandledError: 'unhandled',
              },
            },
          },
        ]);
        await sequence3;
        await sequence;
      });

      it('should not subscribe the effect, if only the result event is subscribed: success case', async () => {
        const sequence3 = expectSequence(store.getEventStream(outIds.results), [
          {
            result: {
              results: [],
              totalResults: 1,
            },
            resultInput: {
              searchString: 'test',
              page: 4,
            },
            completed: false,
          },
          {
            result: {
              results: [],
              totalResults: 1,
            },
            resultInput: {
              searchString: 'test',
              page: 4,
            },
            completed: true,
          },
        ]);
        expect(store.isSubscribed(outIds.combined)).toBe(false);
        inputSubject.next({
          searchString: 'test',
          page: 2,
        });
        inputSubject.next({
          searchString: 'test',
          page: 3,
        });
        inputSubject.next({
          searchString: 'test',
          page: 4,
        });
        const sequence = expectSequence(observable, [
          {
            currentInput: {
              searchString: 'test',
              page: 4,
            },
            resultPending: true,
            resultInput: NO_VALUE,
            result: NO_VALUE,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 4,
            },
            resultPending: true,
            resultInput: {
              searchString: 'test',
              page: 4,
            },
            result: {
              results: [],
              totalResults: 1,
            },
          },
          {
            currentInput: {
              searchString: 'test',
              page: 4,
            },
            resultPending: false,
            resultInput: {
              searchString: 'test',
              page: 4,
            },
            result: {
              results: [],
              totalResults: 1,
            },
          },
        ]);
        await sequence3;
        await sequence;
      });

      it('should invalidate existing combined results while unsubscribed', async () => {
        const sequence = expectSequence(observable, [
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            resultPending: true,
            resultInput: NO_VALUE,
            result: NO_VALUE,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            resultInput: {
              searchString: 'test',
              page: 2,
            },
            result: {
              results: [],
              totalResults: 1,
            },
            resultPending: true,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            resultInput: {
              searchString: 'test',
              page: 2,
            },
            result: {
              results: [],
              totalResults: 1,
            },
            resultPending: false,
          },
        ]);
        inputSubject.next({
          searchString: 'test',
          page: 2,
        });
        await sequence;

        store.dispatch(inIds.invalidate);

        const sequence2 = expectSequence(observable, [
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            resultInput: {
              searchString: 'test',
              page: 2,
            },
            result: {
              results: [],
              totalResults: 1,
            },
            resultPending: false,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            resultInput: {
              searchString: 'test',
              page: 2,
            },
            result: {
              results: [],
              totalResults: 1,
            },
            resultPending: true,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            resultInput: {
              searchString: 'test',
              page: 2,
            },
            result: {
              results: [],
              totalResults: 1,
            },
            resultPending: true,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            resultInput: {
              searchString: 'test',
              page: 2,
            },
            result: {
              results: [],
              totalResults: 1,
            },
            resultPending: false,
          },
        ]);
        await sequence2;
      });

      it('should invalidate existing results while unsubscribed', async () => {
        const sequence = expectSequence(resultObservable, [
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            resultInput: {
              searchString: 'test',
              page: 2,
            },
            result: {
              results: [],
              totalResults: 1,
            },
            resultPending: false,
          },
        ]);
        inputSubject.next({
          searchString: 'test',
          page: 2,
        });
        await sequence;

        store.dispatch(inIds.invalidate);

        const sequence2 = expectSequence(resultObservable, [
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            resultInput: {
              searchString: 'test',
              page: 2,
            },
            result: {
              results: [],
              totalResults: 1,
            },
            resultPending: false,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            resultInput: {
              searchString: 'test',
              page: 2,
            },
            result: {
              results: [],
              totalResults: 1,
            },
            resultPending: false,
          },
        ]);
        await sequence2;
      });
    });

    describe('with lazy/eager input subscription', () => {
      let inIds: EffectInputSignals<InputModel>;
      let outIds: EffectOutputSignals<InputModel, ResultModel, string>;
      let observable: Observable<CombinedEffectResult<InputModel, ResultModel, string>>;

      it('should have correct sequence for input with eager input subscription', async () => {
        const factoryResult = factory.build({ eagerInputSubscription: true });
        inIds = factoryResult.input;
        outIds = factoryResult.output;
        factoryResult.setup(store);
        observable = store.getBehavior(outIds.combined);
        store.addDerivedState(inIds.input, inputSubject.asObservable());
        inputSubject.next({
          searchString: 'test',
          page: 2,
        });
        await expectSequence(observable, [
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            resultPending: true,
            resultInput: NO_VALUE,
            result: NO_VALUE,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            resultInput: {
              searchString: 'test',
              page: 2,
            },
            result: {
              results: [],
              totalResults: 1,
            },
            resultPending: true,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            resultInput: {
              searchString: 'test',
              page: 2,
            },
            result: {
              results: [],
              totalResults: 1,
            },
            resultPending: false,
          },
        ]);
      });

      it('should have correct sequence for input with lazy input subscription', async () => {
        const factoryResult = factory.build({});
        inIds = factoryResult.input;
        outIds = factoryResult.output;
        factoryResult.setup(store);
        observable = store.getBehavior(outIds.combined);
        store.addDerivedState(inIds.input, inputSubject.asObservable());
        inputSubject.next({
          searchString: 'test',
          page: 1,
        });
        const sequence = expectSequence(observable, [
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            resultPending: true,
            resultInput: NO_VALUE,
            result: NO_VALUE,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            resultInput: {
              searchString: 'test',
              page: 2,
            },
            result: {
              results: [],
              totalResults: 1,
            },
            resultPending: true,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            resultInput: {
              searchString: 'test',
              page: 2,
            },
            result: {
              results: [],
              totalResults: 1,
            },
            resultPending: false,
          },
        ]);
        inputSubject.next({
          searchString: 'test',
          page: 2,
        });
        await sequence;
      });
    });

    describe('with trigger', () => {
      let inIds: Omit<EffectInputSignals<InputModel>, 'input'>;
      let outIds: EffectOutputSignals<InputModel, ResultModel, string>;
      let observable: Observable<CombinedEffectResult<InputModel, ResultModel, string>>;

      beforeEach(() => {
        const factoryResult = factory
          .connectId(inputStateId, 'input', false)
          .build({ withTrigger: true });
        inIds = factoryResult.input;
        outIds = factoryResult.output;
        factoryResult.setup(store);
        observable = store.getBehavior(outIds.combined);
      });

      it('should have correct sequence for input', async () => {
        const sequence = expectSequence(observable, [
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            resultPending: false,
            resultInput: NO_VALUE,
            result: NO_VALUE,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 3,
            },
            resultPending: false,
            resultInput: NO_VALUE,
            result: NO_VALUE,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 4,
            },
            resultPending: false,
            resultInput: NO_VALUE,
            result: NO_VALUE,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 4,
            },
            resultPending: true,
            resultInput: NO_VALUE,
            result: NO_VALUE,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 4,
            },
            resultInput: {
              searchString: 'test',
              page: 4,
            },
            result: {
              results: [],
              totalResults: 1,
            },
            resultPending: true,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 4,
            },
            resultInput: {
              searchString: 'test',
              page: 4,
            },
            result: {
              results: [],
              totalResults: 1,
            },
            resultPending: false,
          },
        ]);
        inputSubject.next({
          searchString: 'test',
          page: 2,
        });
        inputSubject.next({
          searchString: 'test',
          page: 3,
        });
        inputSubject.next({
          searchString: 'test',
          page: 4,
        });
        store.dispatch(inIds.trigger);
        await sequence;
      });
    });

    describe('with initial result', () => {
      let outIds: EffectOutputSignals<InputModel, ResultModel, string>;
      let observable: Observable<CombinedEffectResult<InputModel, ResultModel, string>>;

      beforeEach(() => {
        const factoryResult = factory
          .extendSetup(({ store, input }) => store.connect(inputStateId, input.input))
          .build({
            initialResultGetter: () => ({
              results: [],
              totalResults: 0,
            }),
          });
        outIds = factoryResult.output;
        factoryResult.setup(store);
        observable = store.getBehavior(outIds.combined);
      });

      it('should have correct sequence for input', async () => {
        const sequence = expectSequence(observable, [
          {
            currentInput: NO_VALUE,
            resultPending: false,
            result: {
              results: [],
              totalResults: 0,
            },
            resultInput: NO_VALUE,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            resultPending: true,
            result: {
              results: [],
              totalResults: 0,
            },
            resultInput: NO_VALUE,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            resultInput: {
              searchString: 'test',
              page: 2,
            },
            result: {
              results: [],
              totalResults: 1,
            },
            resultPending: true,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            resultInput: {
              searchString: 'test',
              page: 2,
            },
            result: {
              results: [],
              totalResults: 1,
            },
            resultPending: false,
          },
        ]);
        inputSubject.next({
          searchString: 'test',
          page: 2,
        });
        await sequence;
      });
    });

    describe('with effect debounce', () => {
      let outIds: EffectOutputSignals<InputModel, ResultModel, string>;
      let observable: Observable<CombinedEffectResult<InputModel, ResultModel, string>>;

      beforeEach(() => {
        const factoryResult = factory
          .extendSetup(({ store, input }) => store.connect(inputStateId, input.input))
          .build({
            effectDebounceTime: 50,
          });
        outIds = factoryResult.output;
        factoryResult.setup(store);
        observable = store.getBehavior(outIds.combined);
      });

      it('should debounce the effect input', async () => {
        const sequence = expectSequence(observable, [
          {
            currentInput: {
              searchString: 'test',
              page: 4,
            },
            resultPending: true,
            resultInput: NO_VALUE,
            result: NO_VALUE,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 3,
            },
            resultPending: true,
            resultInput: NO_VALUE,
            result: NO_VALUE,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            resultPending: true,
            resultInput: NO_VALUE,
            result: NO_VALUE,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            resultInput: {
              searchString: 'test',
              page: 2,
            },
            result: {
              results: [],
              totalResults: 1,
            },
            resultPending: true,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            resultInput: {
              searchString: 'test',
              page: 2,
            },
            result: {
              results: [],
              totalResults: 1,
            },
            resultPending: false,
          },
        ]);
        inputSubject.next({
          searchString: 'test',
          page: 4,
        });
        inputSubject.next({
          searchString: 'test',
          page: 3,
        });
        inputSubject.next({
          searchString: 'test',
          page: 2,
        });
        await sequence;
        expect(effectCalled).toBe(1);
      });
    });

    describe('with custom input equals', () => {
      let outIds: EffectOutputSignals<InputModel, ResultModel, string>;
      let observable: Observable<CombinedEffectResult<InputModel, ResultModel, string>>;

      beforeEach(() => {
        const factoryResult = factory
          .extendSetup(({ store, input }) => store.connect(inputStateId, input.input))
          .build({
            effectInputEquals: (a, b) => a.searchString === b.searchString,
          });
        outIds = factoryResult.output;
        factoryResult.setup(store);
        observable = store.getBehavior(outIds.combined);
      });

      it('should ignore changes in the page argument', async () => {
        const sequence = expectSequence(observable, [
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            resultPending: true,
            resultInput: NO_VALUE,
            result: NO_VALUE,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            resultInput: {
              searchString: 'test',
              page: 2,
            },
            result: {
              results: [],
              totalResults: 1,
            },
            resultPending: true,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            resultInput: {
              searchString: 'test',
              page: 2,
            },
            result: {
              results: [],
              totalResults: 1,
            },
            resultPending: false,
          },
        ]);
        inputSubject.next({
          searchString: 'test',
          page: 2,
        });
        await sequence;
        const sequence2 = expectSequence(observable, [
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            resultInput: {
              searchString: 'test',
              page: 2,
            },
            result: {
              results: [],
              totalResults: 1,
            },
            resultPending: false,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 3,
            },
            resultInput: {
              searchString: 'test',
              page: 2,
            },
            result: {
              results: [],
              totalResults: 1,
            },
            resultPending: false,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 4,
            },
            resultInput: {
              searchString: 'test',
              page: 2,
            },
            result: {
              results: [],
              totalResults: 1,
            },
            resultPending: false,
          },
        ]);
        inputSubject.next({
          searchString: 'test',
          page: 3,
        });
        inputSubject.next({
          searchString: 'test',
          page: 4,
        });
        await sequence2;
      });
    });

    describe('with custom effect wrapper', () => {
      let outIds: EffectOutputSignals<InputModel, ResultModel, string>;
      let observable: Observable<CombinedEffectResult<InputModel, ResultModel, string>>;

      beforeEach(() => {
        const factoryResult = factory
          .extendSetup(({ store, input }) => store.connect(inputStateId, input.input))
          .build({
            wrappedEffectGetter:
              effect =>
              (input, { store, previousInput, previousResult }) =>
                effect(input, { store, previousInput, previousResult }).pipe(
                  map(r => ({
                    results: isNotEffectError(r) ? r.results.map(e => e + '_extended') : [],
                    totalResults: isNotEffectError(r) ? r.totalResults : 0,
                  })),
                ),
          });
        outIds = factoryResult.output;
        factoryResult.setup(store);
        observable = store.getBehavior(outIds.combined);
      });

      it('should use the custom effect wrapper: completed successes', async () => {
        const sequence = expectSequence(store.getEventStream(outIds.completedResults), [
          {
            result: {
              results: ['test_result_extended'],
              totalResults: 1,
            },
            resultInput: {
              searchString: 'test',
              page: 0,
            },
            completed: true,
          },
          {
            result: {
              results: [],
              totalResults: 1,
            },
            resultInput: {
              searchString: 'test',
              page: 1,
            },
            completed: true,
          },
        ]);
        observable
          .pipe(
            filter(
              c => isNotNoValueType(c.resultInput) && c.resultInput.page === 0 && !c.resultPending,
            ),
            take(1),
          )
          .subscribe(() => {
            observable
              .pipe(
                filter(
                  c =>
                    isNotNoValueType(c.resultInput) && c.resultInput.page === 1 && !c.resultPending,
                ),
                take(1),
              )
              .subscribe();
            inputSubject.next({
              searchString: 'test',
              page: 1,
            });
          });
        inputSubject.next({
          searchString: 'test',
          page: 0,
        });
        await sequence;
      });

      it('should use the custom effect wrapper: all successes', async () => {
        const sequence = expectSequence(store.getEventStream(outIds.results), [
          {
            result: {
              results: ['test_result_extended'],
              totalResults: 1,
            },
            resultInput: {
              searchString: 'test',
              page: 0,
            },
            completed: false,
          },
          {
            result: {
              results: ['test_result_extended'],
              totalResults: 1,
            },
            resultInput: {
              searchString: 'test',
              page: 0,
            },
            completed: true,
          },
          {
            result: {
              results: [],
              totalResults: 1,
            },
            resultInput: {
              searchString: 'test',
              page: 1,
            },
            completed: false,
          },
          {
            result: {
              results: [],
              totalResults: 1,
            },
            resultInput: {
              searchString: 'test',
              page: 1,
            },
            completed: true,
          },
        ]);
        observable
          .pipe(
            filter(
              c => isNotNoValueType(c.resultInput) && c.resultInput.page === 0 && !c.resultPending,
            ),
            take(1),
          )
          .subscribe(() => {
            observable
              .pipe(
                filter(
                  c =>
                    isNotNoValueType(c.resultInput) && c.resultInput.page === 1 && !c.resultPending,
                ),
                take(1),
              )
              .subscribe();
            inputSubject.next({
              searchString: 'test',
              page: 1,
            });
          });
        inputSubject.next({
          searchString: 'test',
          page: 0,
        });
        await sequence;
      });
    });
  });
});
