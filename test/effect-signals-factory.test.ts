import { map, Observable, of, Subject } from 'rxjs';
import { delay, filter, take } from 'rxjs/operators';
import {
  CombinedEffectResult,
  EffectInputSignals,
  EffectOutputSignals,
  EffectSignalsFactory,
  getEffectSignalsFactory,
} from '../src/effect-signals-factory';
import { Effect, Store } from '../src/store';
import { getBehaviorId } from '../src/store-utils';
import { expectSequence, withSubscription } from '../src/test-utils/test-utils';
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

  const inputStateId = getBehaviorId<InputModel>();
  const inputSubject = new Subject<InputModel>();
  let effectCalled = 0;

  const resultEffectId = getEffectId<InputModel, ResultModel>();
  const resultEffect: Effect<InputModel, ResultModel> = (
    input: InputModel,
    _,
    prevInput,
    prevResult,
  ) => {
    effectCalled = effectCalled + 1;
    if (input.searchString === 'throw') {
      throw 'unhandled';
    }
    let totalResults = 1;
    if (prevInput?.searchString === 'addToNext') {
      totalResults += prevResult?.totalResults ?? 0;
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

  let store: Store;

  beforeEach(() => {
    effectCalled = 0;
    store = new Store();
    store.addEffect(resultEffectId, resultEffect);
    store.addBehavior(inputStateId, inputSubject.asObservable(), false);
  });

  describe('getEffectSignalsFactory', () => {
    let factory: EffectSignalsFactory<InputModel, ResultModel>;

    beforeEach(() => {
      factory = getEffectSignalsFactory<InputModel, ResultModel>();
    });

    describe('default settings', () => {
      let inIds: EffectInputSignals<InputModel>;
      let outIds: EffectOutputSignals<InputModel, ResultModel>;
      let observable: Observable<CombinedEffectResult<InputModel, ResultModel>>;

      beforeEach(() => {
        const factoryResult = factory
          .extendSetup((store, inIds) => store.connect(inputStateId, inIds.input))
          .build({ effectId: resultEffectId });
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

      it('should not debounce the effect', async () => {
        const sequence = expectSequence(observable, [
          {
            currentInput: {
              searchString: 'test',
              page: 4,
            },
            resultPending: true,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 3,
            },
            resultPending: true,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 2,
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

          const sequence3 = expectSequence(store.getEventStream(outIds.errors), [
            {
              error: 'unhandled',
              errorInput: {
                searchString: 'throw',
                page: 2,
              },
            },
            {
              error: 'unhandled',
              errorInput: {
                searchString: 'throw',
                page: 3,
              },
            },
          ]);
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

      it('should not subscribe the effect, if only the error event is subscribed', async () => {
        const sequence3 = expectSequence(store.getEventStream(outIds.errors), [
          {
            error: 'unhandled',
            errorInput: {
              searchString: 'throw',
              page: 4,
            },
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
          },
        ]);
        await sequence3;
        await sequence;
      });

      it('should not subscribe the effect, if only the success event is subscribed', async () => {
        const sequence3 = expectSequence(store.getEventStream(outIds.successes), [
          {
            result: {
              results: [],
              totalResults: 1,
            },
            resultInput: {
              searchString: 'test',
              page: 4,
            },
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

      it('should provide previous input and result in the success event', async () => {
        const sequence = expectSequence(store.getEventStream(outIds.successes), [
          {
            result: {
              results: ['test_result'],
              totalResults: 1,
            },
            resultInput: {
              searchString: 'test',
              page: 0,
            },
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
            previousInput: {
              searchString: 'test',
              page: 0,
            },
            previousResult: {
              results: ['test_result'],
              totalResults: 1,
            },
          },
        ]);
        observable
          .pipe(
            filter(c => c.resultInput?.page === 0 && !c.resultPending),
            take(1),
          )
          .subscribe(() => {
            observable
              .pipe(
                filter(c => c.resultInput?.page === 1 && !c.resultPending),
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

      it('should invalidate existing results while unsubscribed', async () => {
        const sequence = expectSequence(observable, [
          {
            currentInput: {
              searchString: 'test',
              page: 2,
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
        store.dispatch(inIds.invalidate, null);
      });
    });

    describe('with trigger', () => {
      let inIds: EffectInputSignals<InputModel>;
      let outIds: EffectOutputSignals<InputModel, ResultModel>;
      let observable: Observable<CombinedEffectResult<InputModel, ResultModel>>;

      beforeEach(() => {
        const factoryResult = factory
          .extendSetup((store, inIds) => store.connect(inputStateId, inIds.input))
          .build({ effectId: resultEffectId, withTrigger: true });
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
          },
          {
            currentInput: {
              searchString: 'test',
              page: 3,
            },
            resultPending: false,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 4,
            },
            resultPending: false,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 4,
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
        store.dispatch(inIds.trigger, null);
        await sequence;
      });
    });

    describe('with initial result', () => {
      let outIds: EffectOutputSignals<InputModel, ResultModel>;
      let observable: Observable<CombinedEffectResult<InputModel, ResultModel>>;

      beforeEach(() => {
        const factoryResult = factory
          .extendSetup((store, inIds) => store.connect(inputStateId, inIds.input))
          .build({
            effectId: resultEffectId,
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
            resultPending: false,
            result: {
              results: [],
              totalResults: 0,
            },
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
      let outIds: EffectOutputSignals<InputModel, ResultModel>;
      let observable: Observable<CombinedEffectResult<InputModel, ResultModel>>;

      beforeEach(() => {
        const factoryResult = factory
          .extendSetup((store, inIds) => store.connect(inputStateId, inIds.input))
          .build({
            effectId: resultEffectId,
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
          },
          {
            currentInput: {
              searchString: 'test',
              page: 3,
            },
            resultPending: true,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 2,
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
      let outIds: EffectOutputSignals<InputModel, ResultModel>;
      let observable: Observable<CombinedEffectResult<InputModel, ResultModel>>;

      beforeEach(() => {
        const factoryResult = factory
          .extendSetup((store, inIds) => store.connect(inputStateId, inIds.input))
          .build({
            effectId: resultEffectId,
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
      let outIds: EffectOutputSignals<InputModel, ResultModel>;
      let observable: Observable<CombinedEffectResult<InputModel, ResultModel>>;

      beforeEach(() => {
        const factoryResult = factory
          .extendSetup((store, inIds) => store.connect(inputStateId, inIds.input))
          .build({
            effectId: resultEffectId,
            wrappedEffectGetter: effect => (input, store, prevInput, prevOutput) =>
              effect(input, store, prevInput, prevOutput).pipe(
                map(r => ({
                  results: r.results.map(e => e + '_extended'),
                  totalResults: r.totalResults,
                })),
              ),
          });
        outIds = factoryResult.output;
        factoryResult.setup(store);
        observable = store.getBehavior(outIds.combined);
      });

      it('should use the custom effect wrapper', async () => {
        const sequence = expectSequence(store.getEventStream(outIds.successes), [
          {
            result: {
              results: ['test_result_extended'],
              totalResults: 1,
            },
            resultInput: {
              searchString: 'test',
              page: 0,
            },
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
            previousInput: {
              searchString: 'test',
              page: 0,
            },
            previousResult: {
              results: ['test_result_extended'],
              totalResults: 1,
            },
          },
        ]);
        observable
          .pipe(
            filter(c => c.resultInput?.page === 0 && !c.resultPending),
            take(1),
          )
          .subscribe(() => {
            observable
              .pipe(
                filter(c => c.resultInput?.page === 1 && !c.resultPending),
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
