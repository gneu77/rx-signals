import { Observable, of, Subject } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Store } from '../src/store';
import { EffectType } from '../src/store.utils';
import {
  InputWithResult,
  InputWithResultSignals,
  prepareInputWithResultSignals
} from './../src/input-with-result-signals.factory';
import { getIdentifier } from './../src/store.utils';
import { expectSequence, withSubscription } from './test.utils';

describe('prepareInputWithResultSignals', () => {
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

  const resultEffect: EffectType<InputModel, ResultModel> = (input: InputModel) => {
    if (input.searchString === 'throw') {
      throw 'unhandled';
    }
    if (input.page > 0) {
      return of({
        results: [],
        totalResults: 1,
      }).pipe(delay(100));
    }
    return of({
      results: [input.searchString + '_result'],
      totalResults: 1,
    }).pipe(delay(100));
  };

  let store: Store;
  let factory: InputWithResultSignals<InputModel, ResultModel>;
  let observable: Observable<InputWithResult<InputModel, ResultModel>>;

  beforeEach(() => {
    store = new Store();
    store.addNonLazyBehavior(inputStateId, inputSubject.asObservable());
  });

  describe('default options', () => {
    beforeEach(() => {
      factory = prepareInputWithResultSignals(s => s.getBehavior(inputStateId), resultEffect);
      factory.setup(store);
      observable = store.getBehavior(factory.inputWithResultBehaviorId);
    });

    it('should have correct sequence for input', async () => {
      const sequence = expectSequence(observable, [
        {
          currentInput: {
            searchString: 'test',
            page: 2,
          },
          resultPending: true,
          unhandledResultEffectError: null,
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
          unhandledResultEffectError: null,
        },
      ]);
      inputSubject.next({
        searchString: 'test',
        page: 2,
      });
      await sequence;
    });

    it('should debounce the result effect', async () => {
      const sequence = expectSequence(observable, [
        {
          currentInput: {
            searchString: 'test',
            page: 0,
          },
          resultPending: true,
          unhandledResultEffectError: null,
        },
        {
          currentInput: {
            searchString: 'test',
            page: 0,
          },
          resultInput: {
            searchString: 'test',
            page: 0,
          },
          result: {
            results: ['test_result'],
            totalResults: 1,
          },
          resultPending: false,
          unhandledResultEffectError: null,
        },
      ]);
      inputSubject.next({
        searchString: 'test',
        page: 2,
      });
      inputSubject.next({
        searchString: 'test',
        page: 1,
      });
      inputSubject.next({
        searchString: 'test',
        page: 0,
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
            unhandledResultEffectError: null,
          },
          {
            currentInput: {
              searchString: 'throw',
              page: 2,
            },
            resultPending: false,
            unhandledResultEffectError: 'unhandled',
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
            unhandledResultEffectError: 'unhandled',
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
            unhandledResultEffectError: 'unhandled',
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
            unhandledResultEffectError: null,
          },
        ]);
        inputSubject.next({
          searchString: 'test',
          page: 2,
        });
        await sequence2;
      });
    });

    it('should invalidate existing results while unsubscribed', async () => {
      const sequence = expectSequence(observable, [
        {
          currentInput: {
            searchString: 'test',
            page: 2,
          },
          resultPending: true,
          unhandledResultEffectError: null,
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
          unhandledResultEffectError: null,
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
          unhandledResultEffectError: null,
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
          unhandledResultEffectError: null,
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
          unhandledResultEffectError: null,
        },
      ]);
      inputSubject.next({
        searchString: 'test',
        page: 2,
      });
      await sequence2;
      store.dispatchEvent(factory.invalidateResultEventId, null);
    });

    describe('derived behaviors', () => {});
  });

  describe('custom input equals function', () => {
    beforeEach(() => {
      factory = prepareInputWithResultSignals(s => s.getBehavior(inputStateId), resultEffect, {
        inputEquals: (prev, next) => prev?.searchString === next?.searchString,
      });
      factory.setup(store);
      observable = store.getBehavior(factory.inputWithResultBehaviorId);
    });

    it('should use custom input equals', async () => {
      await withSubscription(observable, async () => {
        const sequence = expectSequence(observable, [
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            resultPending: true,
            unhandledResultEffectError: null,
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
            unhandledResultEffectError: null,
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
            unhandledResultEffectError: null,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 1,
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
            unhandledResultEffectError: null,
          },
        ]);
        inputSubject.next({
          searchString: 'test',
          page: 1,
        });
        await sequence2;
        const sequence3 = expectSequence(observable, [
          {
            currentInput: {
              searchString: 'test',
              page: 1,
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
            unhandledResultEffectError: null,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 0,
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
            unhandledResultEffectError: null,
          },
        ]);
        inputSubject.next({
          searchString: 'test',
          page: 0,
        });
        await sequence3;
      });
    });
  });

  describe('with initial result', () => {
    beforeEach(() => {
      factory = prepareInputWithResultSignals(s => s.getBehavior(inputStateId), resultEffect, {
        initialResult: {
          results: [],
          totalResults: 0,
        },
      });
      factory.setup(store);
      observable = store.getBehavior(factory.inputWithResultBehaviorId);
    });

    it('should have correct sequence for input', async () => {
      const sequence = expectSequence(observable, [
        {
          result: {
            results: [],
            totalResults: 0,
          },
          resultPending: false,
          unhandledResultEffectError: null,
        },
        {
          currentInput: {
            searchString: 'test',
            page: 2,
          },
          result: {
            results: [],
            totalResults: 0,
          },
          resultPending: true,
          unhandledResultEffectError: null,
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
          unhandledResultEffectError: null,
        },
      ]);
      inputSubject.next({
        searchString: 'test',
        page: 2,
      });
      await sequence;
    });
  });

  describe('with trigger event', () => {
    beforeEach(() => {
      factory = prepareInputWithResultSignals(s => s.getBehavior(inputStateId), resultEffect, {
        withTriggerEvent: true,
      });
      factory.setup(store);
      observable = store.getBehavior(factory.inputWithResultBehaviorId);
    });

    it('should have correct sequence for input with explicit result trigger', async () => {
      const sequence = expectSequence(observable, [
        {
          currentInput: {
            searchString: 'test',
            page: 2,
          },
          resultPending: false,
          unhandledResultEffectError: null,
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
          resultPending: false,
          unhandledResultEffectError: null,
        },
        {
          currentInput: {
            searchString: 'test',
            page: 1,
          },
          resultPending: false,
          unhandledResultEffectError: null,
        },
      ]);
      inputSubject.next({
        searchString: 'test',
        page: 1,
      });
      await sequence2;

      const sequence3 = expectSequence(observable, [
        {
          currentInput: {
            searchString: 'test',
            page: 1,
          },
          resultPending: false,
          unhandledResultEffectError: null,
        },
        {
          currentInput: {
            searchString: 'test',
            page: 1,
          },
          resultPending: true,
          unhandledResultEffectError: null,
        },
        {
          currentInput: {
            searchString: 'test',
            page: 1,
          },
          resultInput: {
            searchString: 'test',
            page: 1,
          },
          result: {
            results: [],
            totalResults: 1,
          },
          resultPending: false,
          unhandledResultEffectError: null,
        },
      ]);
      store.dispatchEvent(factory.triggerResultEffectEventId, null);
      await sequence3;
    });
  });
});
