import { Observable, of, Subject } from 'rxjs';
import { delay } from 'rxjs/operators';
import {
  CombinedEffectResult,
  EffectSignalsFactory,
  EffectSignalsType,
  EffectType,
  getEffectSignalsFactory,
  TriggeredEffectSignalsType
} from '../src/effect-signals-factory';
import { Store } from '../src/store';
import { getIdentifier } from '../src/store.utils';
import { expectSequence, withSubscription } from './test.utils';

describe('effect signals factory', () => {
  interface InputModel {
    readonly searchString: string;
    readonly page: number;
  }

  interface ResultModel {
    readonly results: string[];
    readonly totalResults: number;
  }

  const inputStateId = getIdentifier<InputModel>();
  const inputSubject = new Subject<InputModel>();
  let effectCalled = 0;

  const resultEffect: EffectType<InputModel, ResultModel> = (
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
    store.addNonLazyBehavior(inputStateId, inputSubject.asObservable());
  });

  describe('getEffectSignalsFactory', () => {
    let factory: EffectSignalsFactory<
      InputModel,
      ResultModel,
      EffectSignalsType<InputModel, ResultModel>
    >;

    beforeEach(() => {
      factory = getEffectSignalsFactory<InputModel, ResultModel>(
        store => store.getBehavior(inputStateId),
        resultEffect,
      );
    });

    describe('default settings', () => {
      let signals: EffectSignalsType<InputModel, ResultModel>;
      let observable: Observable<CombinedEffectResult<InputModel, ResultModel>>;

      beforeEach(() => {
        const factoryResult = factory.build();
        signals = factoryResult.signals;
        factoryResult.setup(store);
        observable = store.getBehavior(signals.combinedBehavior);
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

          const sequence3 = expectSequence(store.getEventStream(signals.errorEvents), [
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
        const sequence3 = expectSequence(store.getEventStream(signals.errorEvents), [
          {
            error: 'unhandled',
            errorInput: {
              searchString: 'throw',
              page: 4,
            },
          },
        ]);
        expect(store.isSubscribed(signals.combinedBehavior)).toBe(false);
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
        const sequence3 = expectSequence(store.getEventStream(signals.successEvents), [
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
        expect(store.isSubscribed(signals.combinedBehavior)).toBe(false);
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
        store.dispatchEvent(signals.invalidateEvent, null);
      });
    });

    describe('with trigger', () => {
      let signals: TriggeredEffectSignalsType<InputModel, ResultModel>;
      let observable: Observable<CombinedEffectResult<InputModel, ResultModel>>;

      beforeEach(() => {
        const factoryResult = factory.withTrigger().build();
        signals = factoryResult.signals;
        factoryResult.setup(store);
        observable = store.getBehavior(signals.combinedBehavior);
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
        store.dispatchEvent(signals.triggerEvent, null);
        await sequence;
      });
    });

    describe('with initial result', () => {
      let signals: EffectSignalsType<InputModel, ResultModel>;
      let observable: Observable<CombinedEffectResult<InputModel, ResultModel>>;

      beforeEach(() => {
        const factoryResult = factory
          .withInitialResult(() => ({
            results: [],
            totalResults: 0,
          }))
          .build();
        signals = factoryResult.signals;
        factoryResult.setup(store);
        observable = store.getBehavior(signals.combinedBehavior);
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
      let signals: EffectSignalsType<InputModel, ResultModel>;
      let observable: Observable<CombinedEffectResult<InputModel, ResultModel>>;

      beforeEach(() => {
        const factoryResult = factory.withEffectDebounce(50).build();
        signals = factoryResult.signals;
        factoryResult.setup(store);
        observable = store.getBehavior(signals.combinedBehavior);
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
      let signals: EffectSignalsType<InputModel, ResultModel>;
      let observable: Observable<CombinedEffectResult<InputModel, ResultModel>>;

      beforeEach(() => {
        const factoryResult = factory
          .withCustomEffectInputEquals((a, b) => a.searchString === b.searchString)
          .build();
        signals = factoryResult.signals;
        factoryResult.setup(store);
        observable = store.getBehavior(signals.combinedBehavior);
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
  });
});
