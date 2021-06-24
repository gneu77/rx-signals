import { Observable, of, Subject } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Store } from '../src/store';
import { EffectType } from '../src/store.utils';
import {
  prepareValidatedInputSignals,
  ValidatedInput,
  ValidatedInputSignals
} from '../src/validated-input-signals.factory';
import { getIdentifier } from './../src/store.utils';
import { expectSequence, withSubscription } from './test.utils';

describe('prepareValidatedInputSignals', () => {
  interface InputModel {
    readonly searchString: string;
    readonly page: number;
  }

  type ValidationResult = string | null;

  const inputStateId = getIdentifier<InputModel>();
  const inputSubject = new Subject<InputModel>();

  const validationEffect: EffectType<InputModel, ValidationResult> = (input: InputModel) => {
    if (input.searchString === 'throw') {
      throw 'unhandled';
    }
    return of(input.searchString === 'invalid' ? 'nope' : null).pipe(delay(10));
  };

  let store: Store;
  let factory: ValidatedInputSignals<InputModel, ValidationResult>;
  let observable: Observable<ValidatedInput<InputModel, ValidationResult>>;

  beforeEach(() => {
    store = new Store();
    store.addNonLazyBehavior(inputStateId, inputSubject.asObservable());
  });

  describe('default options', () => {
    beforeEach(() => {
      factory = prepareValidatedInputSignals(s => s.getBehavior(inputStateId), validationEffect);
      factory.setup(store);
      observable = store.getBehavior(factory.validatedInputBehaviorId);
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
          unhandledValidationEffectError: null,
        },
        {
          currentInput: {
            searchString: 'test',
            page: 2,
          },
          validationPending: false,
          isValid: true,
          unhandledValidationEffectError: null,
          validatedInput: {
            searchString: 'test',
            page: 2,
          },
          validationResult: null,
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
          unhandledValidationEffectError: null,
        },
        {
          currentInput: {
            searchString: 'invalid',
            page: 2,
          },
          validationPending: false,
          isValid: false,
          unhandledValidationEffectError: null,
          validatedInput: {
            searchString: 'invalid',
            page: 2,
          },
          validationResult: 'nope',
        },
      ]);
      inputSubject.next({
        searchString: 'invalid',
        page: 2,
      });
      await sequence;
    });

    it('should debounce the validation effect', async () => {
      const sequence = expectSequence(observable, [
        {
          currentInput: {
            searchString: 'test',
            page: 3,
          },
          validationPending: true,
          isValid: false,
          unhandledValidationEffectError: null,
        },
        {
          currentInput: {
            searchString: 'test',
            page: 3,
          },
          validationPending: false,
          isValid: true,
          unhandledValidationEffectError: null,
          validatedInput: {
            searchString: 'test',
            page: 3,
          },
          validationResult: null,
        },
      ]);
      inputSubject.next({
        searchString: 'test',
        page: 1,
      });
      inputSubject.next({
        searchString: 'test',
        page: 2,
      });
      inputSubject.next({
        searchString: 'test',
        page: 3,
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
            validationPending: true,
            isValid: false,
            unhandledValidationEffectError: null,
          },
          {
            currentInput: {
              searchString: 'throw',
              page: 2,
            },
            validationPending: false,
            isValid: false,
            unhandledValidationEffectError: 'unhandled',
            validatedInput: {
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
            validationPending: false,
            isValid: false,
            unhandledValidationEffectError: 'unhandled',
            validatedInput: {
              searchString: 'throw',
              page: 2,
            },
          },
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            validationPending: true,
            isValid: false,
            unhandledValidationEffectError: 'unhandled',
            validatedInput: {
              searchString: 'throw',
              page: 2,
            },
          },
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            validationPending: false,
            isValid: true,
            unhandledValidationEffectError: null,
            validatedInput: {
              searchString: 'test',
              page: 2,
            },
            validationResult: null,
          },
        ]);
        inputSubject.next({
          searchString: 'test',
          page: 2,
        });
        await sequence2;
      });
    });

    describe('derived behaviors', () => {
      it('should have correct validationPending behavior', async () => {
        await withSubscription(store.getBehavior(factory.validationPendingBehaviorId), async () => {
          const sequence = expectSequence(store.getBehavior(factory.validationPendingBehaviorId), [
            true,
            false,
          ]);
          inputSubject.next({
            searchString: 'throw',
            page: 2,
          });
          await sequence;
          const sequence2 = expectSequence(store.getBehavior(factory.validationPendingBehaviorId), [
            false,
            true,
            false,
          ]);
          inputSubject.next({
            searchString: 'test',
            page: 2,
          });
          await sequence2;
        });
      });

      it('should have correct isValid behavior', async () => {
        await withSubscription(store.getBehavior(factory.isValidBehaviorId), async () => {
          const sequence = expectSequence(store.getBehavior(factory.isValidBehaviorId), [false]);
          inputSubject.next({
            searchString: 'throw',
            page: 2,
          });
          await sequence;
          const sequence2 = expectSequence(store.getBehavior(factory.isValidBehaviorId), [
            false,
            true,
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

  describe('custom input equals function', () => {
    beforeEach(() => {
      factory = prepareValidatedInputSignals(s => s.getBehavior(inputStateId), validationEffect, {
        inputEquals: (prev, next) => prev?.searchString === next?.searchString,
      });
      factory.setup(store);
      observable = store.getBehavior(factory.validatedInputBehaviorId);
    });

    it('should use custom input equals', async () => {
      await withSubscription(observable, async () => {
        const sequence = expectSequence(observable, [
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            validationPending: true,
            isValid: false,
            unhandledValidationEffectError: null,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            validationPending: false,
            isValid: true,
            unhandledValidationEffectError: null,
            validatedInput: {
              searchString: 'test',
              page: 2,
            },
            validationResult: null,
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
            unhandledValidationEffectError: null,
            validatedInput: {
              searchString: 'test',
              page: 2,
            },
            validationResult: null,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 1,
            },
            validationPending: false,
            isValid: true,
            unhandledValidationEffectError: null,
            validatedInput: {
              searchString: 'test',
              page: 2,
            },
            validationResult: null,
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
            unhandledValidationEffectError: null,
            validatedInput: {
              searchString: 'test',
              page: 2,
            },
            validationResult: null,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 0,
            },
            validationPending: false,
            isValid: true,
            unhandledValidationEffectError: null,
            validatedInput: {
              searchString: 'test',
              page: 2,
            },
            validationResult: null,
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

  describe('custom is valid function', () => {
    beforeEach(() => {
      factory = prepareValidatedInputSignals(s => s.getBehavior(inputStateId), validationEffect, {
        isValid: result => result === 'nope',
      });
      factory.setup(store);
      observable = store.getBehavior(factory.validatedInputBehaviorId);
    });

    it('should use a custom isValid function', async () => {
      await withSubscription(observable, async () => {
        const sequence = expectSequence(observable, [
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            validationPending: true,
            isValid: false,
            unhandledValidationEffectError: null,
          },
          {
            currentInput: {
              searchString: 'test',
              page: 2,
            },
            validationPending: false,
            isValid: false,
            unhandledValidationEffectError: null,
            validatedInput: {
              searchString: 'test',
              page: 2,
            },
            validationResult: null,
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
            isValid: false,
            unhandledValidationEffectError: null,
            validatedInput: {
              searchString: 'test',
              page: 2,
            },
            validationResult: null,
          },
          {
            currentInput: {
              searchString: 'invalid',
              page: 2,
            },
            validationPending: true,
            isValid: false,
            unhandledValidationEffectError: null,
            validatedInput: {
              searchString: 'test',
              page: 2,
            },
            validationResult: null,
          },
          {
            currentInput: {
              searchString: 'invalid',
              page: 2,
            },
            validationPending: false,
            isValid: true,
            unhandledValidationEffectError: null,
            validatedInput: {
              searchString: 'invalid',
              page: 2,
            },
            validationResult: 'nope',
          },
        ]);
        inputSubject.next({
          searchString: 'invalid',
          page: 2,
        });
        await sequence2;
      });
    });
  });
});
