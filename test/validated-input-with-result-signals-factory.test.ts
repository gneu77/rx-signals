import { Observable, of, Subject } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Signals } from '../src/signals-factory';
import { Store } from '../src/store';
import { EffectType, getIdentifier } from '../src/store.utils';
import {
  getValidatedInputWithResultSignalsFactory,
  ValidatedInputWithResult,
  ValidatedInputWithResultSignalsFactory,
  ValidatedInputWithResultSignalsType,
  ValidatedInputWithTriggeredResultSignalsType
} from './../src/validated-input-with-result-factory';
import { expectSequence, withSubscription } from './test.utils';

describe('validated input with result signals factory', () => {
  interface InputModel {
    readonly searchString: string;
    readonly page: number;
  }

  type ValidationResult = string | null;

  interface ResultModel {
    readonly results: string[];
    readonly totalResults: number;
  }

  const inputStateId = getIdentifier<InputModel>();
  const inputSubject = new Subject<InputModel>();

  const validationEffect: EffectType<InputModel, ValidationResult> = (input: InputModel) => {
    if (input.searchString === 'throw') {
      throw 'unhandled';
    }
    return of(input.searchString === 'invalid' ? 'nope' : null).pipe(delay(10));
  };

  const resultEffect: EffectType<InputModel, ResultModel> = (input: InputModel) => {
    if (input.searchString === 'throw') {
      throw 'unhandled';
    }
    if (input.page > 0) {
      return of({
        results: [],
        totalResults: 1,
      }).pipe(delay(10));
    }
    return of({
      results: [input.searchString + '_result'],
      totalResults: 1,
    }).pipe(delay(10));
  };

  let store: Store;

  beforeEach(() => {
    store = new Store();
    store.addNonLazyBehavior(inputStateId, inputSubject.asObservable());
  });

  describe('default options', () => {
    let factory: ValidatedInputWithResultSignalsFactory<
      InputModel,
      ValidationResult,
      ResultModel,
      ValidatedInputWithResultSignalsType<InputModel, ValidationResult, ResultModel>
    >;
    let observable: Observable<ValidatedInputWithResult<InputModel, ValidationResult, ResultModel>>;

    beforeEach(() => {
      factory = getValidatedInputWithResultSignalsFactory(
        s => s.getBehavior(inputStateId),
        validationEffect,
        validationResult => (validationResult === null ? true : false),
        resultEffect,
      );
      const signals = factory.build();
      signals.setup(store);
      observable = store.getBehavior(signals.signals.combinedBehavior);
    });

    it('should have correct sequence for valid input', async () => {
      const sequence = expectSequence(observable, [
        {
          currentInput: {
            searchString: 'test',
            page: 2,
          },
          validationPending: true,
          isValid: false,
          resultPending: false,
        },
        {
          currentInput: {
            searchString: 'test',
            page: 2,
          },
          validationPending: false,
          isValid: true,
          validatedInput: {
            searchString: 'test',
            page: 2,
          },
          validationResult: null,
          resultPending: true,
        },
        {
          currentInput: {
            searchString: 'test',
            page: 2,
          },
          validationPending: false,
          isValid: true,
          validatedInput: {
            searchString: 'test',
            page: 2,
          },
          validationResult: null,
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

    it('should have correct sequence for invalid input', async () => {
      const sequence = expectSequence(observable, [
        {
          currentInput: {
            searchString: 'invalid',
            page: 2,
          },
          validationPending: true,
          isValid: false,
          resultPending: false,
        },
        {
          currentInput: {
            searchString: 'invalid',
            page: 2,
          },
          validationPending: false,
          isValid: false,
          validatedInput: {
            searchString: 'invalid',
            page: 2,
          },
          validationResult: 'nope',
          resultPending: false,
        },
      ]);
      inputSubject.next({
        searchString: 'invalid',
        page: 2,
      });
      await sequence;
    });
  });

  // describe('custom input equals function', () => {
  //   beforeEach(() => {
  //     factory = prepareValidatedInputWithResultSignals(
  //       s => s.getBehavior(inputStateId),
  //       validationEffect,
  //       resultEffect,
  //       {
  //         inputDebounceTime: 0,
  //         inputEquals: (prev, next) => prev?.searchString === next?.searchString,
  //       },
  //     );
  //     factory.setup(store);
  //     observable = store.getBehavior(factory.validatedInputWithResultBehaviorId);
  //   });

  //   it('should use custom input equals', async () => {
  //     await withSubscription(observable, async () => {
  //       const sequence = expectSequence(observable, [
  //         {
  //           currentInput: {
  //             searchString: 'test',
  //             page: 2,
  //           },
  //           validationPending: true,
  //           isValid: false,
  //           unhandledValidationEffectError: null,
  //           resultPending: false,
  //           unhandledResultEffectError: null,
  //         },
  //         {
  //           currentInput: {
  //             searchString: 'test',
  //             page: 2,
  //           },
  //           validationPending: false,
  //           isValid: true,
  //           unhandledValidationEffectError: null,
  //           validatedInput: {
  //             searchString: 'test',
  //             page: 2,
  //           },
  //           validationResult: null,
  //           resultPending: true,
  //           unhandledResultEffectError: null,
  //         },
  //         {
  //           currentInput: {
  //             searchString: 'test',
  //             page: 2,
  //           },
  //           validationPending: false,
  //           isValid: true,
  //           unhandledValidationEffectError: null,
  //           validatedInput: {
  //             searchString: 'test',
  //             page: 2,
  //           },
  //           validationResult: null,
  //           resultInput: {
  //             searchString: 'test',
  //             page: 2,
  //           },
  //           result: {
  //             results: [],
  //             totalResults: 1,
  //           },
  //           resultPending: false,
  //           unhandledResultEffectError: null,
  //         },
  //       ]);
  //       inputSubject.next({
  //         searchString: 'test',
  //         page: 2,
  //       });
  //       await sequence;
  //       const sequence2 = expectSequence(observable, [
  //         {
  //           currentInput: {
  //             searchString: 'test',
  //             page: 2,
  //           },
  //           validationPending: false,
  //           isValid: true,
  //           unhandledValidationEffectError: null,
  //           validatedInput: {
  //             searchString: 'test',
  //             page: 2,
  //           },
  //           validationResult: null,
  //           resultInput: {
  //             searchString: 'test',
  //             page: 2,
  //           },
  //           result: {
  //             results: [],
  //             totalResults: 1,
  //           },
  //           resultPending: false,
  //           unhandledResultEffectError: null,
  //         },
  //         {
  //           currentInput: {
  //             searchString: 'test',
  //             page: 1,
  //           },
  //           validationPending: false,
  //           isValid: true,
  //           unhandledValidationEffectError: null,
  //           validatedInput: {
  //             searchString: 'test',
  //             page: 2,
  //           },
  //           validationResult: null,
  //           resultInput: {
  //             searchString: 'test',
  //             page: 2,
  //           },
  //           result: {
  //             results: [],
  //             totalResults: 1,
  //           },
  //           resultPending: false,
  //           unhandledResultEffectError: null,
  //         },
  //       ]);
  //       inputSubject.next({
  //         searchString: 'test',
  //         page: 1,
  //       });
  //       await sequence2;
  //       const sequence3 = expectSequence(observable, [
  //         {
  //           currentInput: {
  //             searchString: 'test',
  //             page: 1,
  //           },
  //           validationPending: false,
  //           isValid: true,
  //           unhandledValidationEffectError: null,
  //           validatedInput: {
  //             searchString: 'test',
  //             page: 2,
  //           },
  //           validationResult: null,
  //           resultInput: {
  //             searchString: 'test',
  //             page: 2,
  //           },
  //           result: {
  //             results: [],
  //             totalResults: 1,
  //           },
  //           resultPending: false,
  //           unhandledResultEffectError: null,
  //         },
  //         {
  //           currentInput: {
  //             searchString: 'test',
  //             page: 0,
  //           },
  //           validationPending: false,
  //           isValid: true,
  //           unhandledValidationEffectError: null,
  //           validatedInput: {
  //             searchString: 'test',
  //             page: 2,
  //           },
  //           validationResult: null,
  //           resultInput: {
  //             searchString: 'test',
  //             page: 2,
  //           },
  //           result: {
  //             results: [],
  //             totalResults: 1,
  //           },
  //           resultPending: false,
  //           unhandledResultEffectError: null,
  //         },
  //       ]);
  //       inputSubject.next({
  //         searchString: 'test',
  //         page: 0,
  //       });
  //       await sequence3;
  //     });
  //   });
  // });

  describe('with trigger event', () => {
    let factory: ValidatedInputWithResultSignalsFactory<
      InputModel,
      ValidationResult,
      ResultModel,
      ValidatedInputWithTriggeredResultSignalsType<InputModel, ValidationResult, ResultModel>
    >;
    let observable: Observable<ValidatedInputWithResult<InputModel, ValidationResult, ResultModel>>;
    let signals: Signals<
      ValidatedInputWithTriggeredResultSignalsType<InputModel, ValidationResult, ResultModel>
    >;

    beforeEach(() => {
      factory = getValidatedInputWithResultSignalsFactory(
        s => s.getBehavior(inputStateId),
        validationEffect,
        validationResult => (validationResult === null ? true : false),
        resultEffect,
      ).withTrigger();
      signals = factory.build();
      signals.setup(store);
      observable = store.getBehavior(signals.signals.combinedBehavior);
    });

    it('should have correct sequence for input with explicit result trigger', async () => {
      const sequence = expectSequence(observable, [
        {
          currentInput: {
            searchString: 'test',
            page: 2,
          },
          validationPending: true,
          isValid: false,
          resultPending: false,
        },
        {
          currentInput: {
            searchString: 'test',
            page: 2,
          },
          validationPending: false,
          isValid: true,
          validatedInput: {
            searchString: 'test',
            page: 2,
          },
          validationResult: null,
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
          validationPending: false,
          isValid: true,
          validatedInput: {
            searchString: 'test',
            page: 2,
          },
          validationResult: null,
          resultPending: false,
        },
        {
          currentInput: {
            searchString: 'test',
            page: 1,
          },
          validationPending: true,
          isValid: true,
          validatedInput: {
            searchString: 'test',
            page: 2,
          },
          validationResult: null,
          resultPending: false,
        },
        {
          currentInput: {
            searchString: 'test',
            page: 1,
          },
          validationPending: false,
          isValid: true,
          validatedInput: {
            searchString: 'test',
            page: 1,
          },
          validationResult: null,
          resultPending: false,
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
          validationPending: false,
          isValid: true,
          validatedInput: {
            searchString: 'test',
            page: 1,
          },
          validationResult: null,
          resultPending: false,
        },
        {
          currentInput: {
            searchString: 'test',
            page: 1,
          },
          validationPending: false,
          isValid: true,
          validatedInput: {
            searchString: 'test',
            page: 1,
          },
          validationResult: null,
          resultPending: true,
        },
        {
          currentInput: {
            searchString: 'test',
            page: 1,
          },
          validationPending: false,
          isValid: true,
          validatedInput: {
            searchString: 'test',
            page: 1,
          },
          validationResult: null,
          resultPending: false,
          resultInput: {
            searchString: 'test',
            page: 1,
          },
          result: {
            results: [],
            totalResults: 1,
          },
        },
      ]);
      store.dispatchEvent(signals.signals.resultTriggerEvent, null);
      await sequence3;
    });

    it('should not trigger effect, if trigger is sent while invalid and then input becomes valid', async () => {
      await withSubscription(observable, async () => {
        const sequence = expectSequence(observable, [
          {
            currentInput: {
              searchString: 'invalid',
              page: 2,
            },
            validationPending: true,
            isValid: false,
            resultPending: false,
          },
          {
            currentInput: {
              searchString: 'invalid',
              page: 2,
            },
            validationPending: false,
            isValid: false,
            validatedInput: {
              searchString: 'invalid',
              page: 2,
            },
            validationResult: 'nope',
            resultPending: false,
          },
        ]);
        inputSubject.next({
          searchString: 'invalid',
          page: 2,
        });
        await sequence;

        store.dispatchEvent(signals.signals.resultTriggerEvent, null);

        const sequence2 = expectSequence(observable, [
          {
            currentInput: {
              searchString: 'invalid',
              page: 2,
            },
            validationPending: false,
            isValid: false,
            validatedInput: {
              searchString: 'invalid',
              page: 2,
            },
            validationResult: 'nope',
            resultPending: false,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            validationPending: true,
            isValid: false,
            validatedInput: {
              searchString: 'invalid',
              page: 2,
            },
            validationResult: 'nope',
            resultPending: false,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            validationPending: false,
            isValid: true,
            validatedInput: {
              searchString: 'test',
              page: 2,
            },
            validationResult: null,
            resultPending: false,
          },
        ]);
        inputSubject.next({
          searchString: 'test',
          page: 2,
        });
        await sequence2;
      });
    });
  });
});
