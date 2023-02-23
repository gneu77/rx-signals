import { Observable, Subject, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Signals } from '../src/signals-factory';
import { Effect, Store } from '../src/store';
import { expectSequence, withSubscription } from '../src/test-utils/test-utils';
import { NO_VALUE, getEffectId, getStateId } from './../src/store-utils';
import {
  ValidatedInputWithResult,
  ValidatedInputWithResultFactory,
  ValidatedInputWithResultInput,
  ValidatedInputWithResultOutput,
  getValidatedInputWithResultSignalsFactory,
} from './../src/validated-input-with-result-signals-factory';

describe('validated input with result signals factory', () => {
  type InputModel = {
    searchString: string;
    page: number;
  };

  type ValidationResult = string | null;

  type ResultModel = {
    results: string[];
    totalResults: number;
  };

  const inputStateId = getStateId<InputModel>();
  const inputSubject = new Subject<InputModel>();

  const validationEffectId = getEffectId<InputModel, ValidationResult, string>();
  const validationEffect: Effect<InputModel, ValidationResult, string> = (input: InputModel) => {
    if (input.searchString === 'throw') {
      throw 'unhandled';
    }
    return of(input.searchString === 'invalid' ? 'nope' : null).pipe(delay(10));
  };

  const resultEffectId = getEffectId<InputModel, ResultModel, string>();
  const resultEffect: Effect<InputModel, ResultModel, string> = (input: InputModel) => {
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
    store.addEffect(validationEffectId, validationEffect);
    store.addEffect(resultEffectId, resultEffect);
    store.connectObservable(inputSubject.asObservable(), inputStateId);
  });

  describe('default options', () => {
    let factory: ValidatedInputWithResultFactory<
      InputModel,
      ValidationResult,
      ResultModel,
      string,
      string
    >;
    let observable: Observable<
      ValidatedInputWithResult<InputModel, ValidationResult, ResultModel, string, string>
    >;

    beforeEach(() => {
      factory = getValidatedInputWithResultSignalsFactory<
        InputModel,
        ValidationResult,
        ResultModel,
        string,
        string
      >()
        .extendSetup(({ store, input }) => {
          store.connect(inputStateId, input.input);
        })
        .useExistingEffect('validation', () => validationEffectId, true)
        .useExistingEffect('result', () => resultEffectId, true);
      const signals = factory.build({
        nameExtension: 'test',
      });
      signals.setup(store);
      observable = store.getBehavior(signals.output.combined);
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
          validatedInput: NO_VALUE,
          validationResult: NO_VALUE,
          resultPending: false,
          resultInput: NO_VALUE,
          result: NO_VALUE,
        },
        {
          currentInput: {
            searchString: 'test',
            page: 2,
          },
          validationPending: true,
          isValid: false, // cause validation is still pending
          validatedInput: {
            searchString: 'test',
            page: 2,
          },
          validationResult: null,
          resultPending: false,
          resultInput: NO_VALUE,
          result: NO_VALUE,
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
          resultInput: NO_VALUE,
          result: NO_VALUE,
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
          validatedInput: NO_VALUE,
          validationResult: NO_VALUE,
          isValid: false,
          resultPending: false,
          resultInput: NO_VALUE,
          result: NO_VALUE,
        },
        {
          currentInput: {
            searchString: 'invalid',
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
          resultInput: NO_VALUE,
          result: NO_VALUE,
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
          resultInput: NO_VALUE,
          result: NO_VALUE,
        },
      ]);
      inputSubject.next({
        searchString: 'invalid',
        page: 2,
      });
      await sequence;
    });
  });

  describe('with trigger event', () => {
    let factory: ValidatedInputWithResultFactory<
      InputModel,
      ValidationResult,
      ResultModel,
      string,
      string
    >;
    let observable: Observable<
      ValidatedInputWithResult<InputModel, ValidationResult, ResultModel, string, string>
    >;
    let signals: Signals<
      ValidatedInputWithResultInput<InputModel>,
      ValidatedInputWithResultOutput<InputModel, ValidationResult, ResultModel, string, string>
    >;

    beforeEach(() => {
      factory = getValidatedInputWithResultSignalsFactory<
        InputModel,
        ValidationResult,
        ResultModel,
        string,
        string
      >()
        .extendSetup(({ store, input }) => store.connect(inputStateId, input.input))
        .useExistingEffect('validation', () => validationEffectId, true)
        .useExistingEffect('result', () => resultEffectId, true);
      signals = factory.build({
        withResultTrigger: true,
      });
      signals.setup(store);
      observable = store.getBehavior(signals.output.combined);
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
          validatedInput: NO_VALUE,
          validationResult: NO_VALUE,
          resultPending: false,
          resultInput: NO_VALUE,
          result: NO_VALUE,
        },
        {
          currentInput: {
            searchString: 'test',
            page: 2,
          },
          validationPending: true,
          isValid: false,
          validatedInput: {
            searchString: 'test',
            page: 2,
          },
          validationResult: null,
          resultPending: false,
          resultInput: NO_VALUE,
          result: NO_VALUE,
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
          resultInput: NO_VALUE,
          result: NO_VALUE,
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
          resultInput: NO_VALUE,
          result: NO_VALUE,
        },
        {
          currentInput: {
            searchString: 'test',
            page: 1,
          },
          validationPending: true,
          isValid: false,
          validatedInput: {
            searchString: 'test',
            page: 2,
          },
          validationResult: null,
          resultPending: false,
          resultInput: NO_VALUE,
          result: NO_VALUE,
        },
        {
          currentInput: {
            searchString: 'test',
            page: 1,
          },
          validationPending: true,
          isValid: false,
          validatedInput: {
            searchString: 'test',
            page: 1,
          },
          validationResult: null,
          resultPending: false,
          resultInput: NO_VALUE,
          result: NO_VALUE,
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
          resultInput: NO_VALUE,
          result: NO_VALUE,
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
          resultInput: NO_VALUE,
          result: NO_VALUE,
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
          resultInput: NO_VALUE,
          result: NO_VALUE,
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
          resultInput: {
            searchString: 'test',
            page: 1,
          },
          result: {
            results: [],
            totalResults: 1,
          },
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
      store.dispatch(signals.input.resultTrigger);
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
            validatedInput: NO_VALUE,
            validationResult: NO_VALUE,
            resultPending: false,
            resultInput: NO_VALUE,
            result: NO_VALUE,
          },
          {
            currentInput: {
              searchString: 'invalid',
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
            resultInput: NO_VALUE,
            result: NO_VALUE,
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
            resultInput: NO_VALUE,
            result: NO_VALUE,
          },
        ]);
        inputSubject.next({
          searchString: 'invalid',
          page: 2,
        });
        await sequence;

        store.dispatch(signals.input.resultTrigger);

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
            resultInput: NO_VALUE,
            result: NO_VALUE,
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
            resultInput: NO_VALUE,
            result: NO_VALUE,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            validationPending: true,
            isValid: false,
            validatedInput: {
              searchString: 'test',
              page: 2,
            },
            validationResult: null,
            resultPending: false,
            resultInput: NO_VALUE,
            result: NO_VALUE,
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
            resultInput: NO_VALUE,
            result: NO_VALUE,
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

  describe('with initial result', () => {
    let factory: ValidatedInputWithResultFactory<
      InputModel,
      ValidationResult,
      ResultModel,
      string,
      string
    >;
    let observable: Observable<
      ValidatedInputWithResult<InputModel, ValidationResult, ResultModel, string, string>
    >;

    beforeEach(() => {
      factory = getValidatedInputWithResultSignalsFactory<
        InputModel,
        ValidationResult,
        ResultModel,
        string,
        string
      >()
        .extendSetup(({ store, input }) => store.connect(inputStateId, input.input))
        .useExistingEffect('validation', () => validationEffectId, true)
        .useExistingEffect('result', () => resultEffectId, true);
      const signals = factory.build({
        initialResultGetter: () => ({
          results: [],
          totalResults: 0,
        }),
      });
      signals.setup(store);
      observable = store.getBehavior(signals.output.combined);
    });

    it('should have correct sequence for valid input', async () => {
      const sequence = expectSequence(observable, [
        {
          currentInput: {
            searchString: 'test',
            page: 2,
          },
          validationPending: true,
          validatedInput: NO_VALUE,
          validationResult: NO_VALUE,
          isValid: false,
          resultPending: false,
          resultInput: NO_VALUE,
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
          validationPending: true,
          isValid: false,
          validatedInput: {
            searchString: 'test',
            page: 2,
          },
          validationResult: null,
          resultPending: false,
          resultInput: NO_VALUE,
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
          validationPending: false,
          isValid: true,
          validatedInput: {
            searchString: 'test',
            page: 2,
          },
          validationResult: null,
          resultPending: true,
          resultInput: NO_VALUE,
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
  });

  describe('with custom result input equals', () => {
    let factory: ValidatedInputWithResultFactory<
      InputModel,
      ValidationResult,
      ResultModel,
      string,
      string
    >;
    let observable: Observable<
      ValidatedInputWithResult<InputModel, ValidationResult, ResultModel, string, string>
    >;

    beforeEach(() => {
      factory = getValidatedInputWithResultSignalsFactory<
        InputModel,
        ValidationResult,
        ResultModel,
        string,
        string
      >()
        .extendSetup(({ store, input }) => store.connect(inputStateId, input.input))
        .useExistingEffect('validation', () => validationEffectId, true)
        .useExistingEffect('result', () => resultEffectId, true);
      const signals = factory.build({
        resultEffectInputEquals: (a, b) => a.searchString === b.searchString,
      });
      signals.setup(store);
      observable = store.getBehavior(signals.output.combined);
    });

    it('should ignore changes in the page argument', async () => {
      const sequence = expectSequence(observable, [
        {
          currentInput: {
            searchString: 'test',
            page: 2,
          },
          validationPending: true,
          isValid: false,
          validatedInput: NO_VALUE,
          validationResult: NO_VALUE,
          resultPending: false,
          resultInput: NO_VALUE,
          result: NO_VALUE,
        },
        {
          currentInput: {
            searchString: 'test',
            page: 2,
          },
          validationPending: true,
          isValid: false,
          validatedInput: {
            searchString: 'test',
            page: 2,
          },
          validationResult: null,
          resultPending: false,
          resultInput: NO_VALUE,
          result: NO_VALUE,
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
          resultInput: NO_VALUE,
          result: NO_VALUE,
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
          validationPending: true,
          isValid: false,
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
        {
          currentInput: {
            searchString: 'test',
            page: 4,
          },
          validationPending: true,
          isValid: false,
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
        {
          currentInput: {
            searchString: 'test',
            page: 4,
          },
          validationPending: true,
          isValid: false,
          validatedInput: {
            searchString: 'test',
            page: 4,
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
        {
          currentInput: {
            searchString: 'test',
            page: 4,
          },
          validationPending: false,
          isValid: true,
          validatedInput: {
            searchString: 'test',
            page: 4,
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
