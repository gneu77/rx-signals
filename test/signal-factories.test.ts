import { Observable, of, Subject } from 'rxjs';
import { delay } from 'rxjs/operators';
import {
  CombinedEffectResult,
  EffectSignalsFactory,
  EffectSignalsType,
  getEffectSignalsFactory
} from '../src/signal-factories';
import { Store } from '../src/store';
import { EffectType, getIdentifier } from '../src/store.utils';
import { expectSequence, withSubscription } from './test.utils';

describe('signal factories', () => {
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

  const resultEffect: EffectType<InputModel, ResultModel> = (
    input: InputModel,
    _,
    prevInput,
    prevResult,
  ) => {
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
    store = new Store();
    store.addNonLazyBehavior(inputStateId, inputSubject.asObservable());
  });

  describe('getEffectSignalsFactory', () => {
    let factory: EffectSignalsFactory<EffectSignalsType<InputModel, ResultModel>, undefined>;

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
  });
});
