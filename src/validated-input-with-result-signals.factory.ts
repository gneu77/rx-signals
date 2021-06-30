import { NEVER, Observable } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import {
  InputWithResult,
  InputWithResultSignals,
  InputWithResultSignalsFactoryOptions,
  prepareInputWithResultSignals,
} from './input-with-result-signals.factory';
import { Store, TypeIdentifier } from './store';
import { EffectType, getIdentifier, UnhandledEffectErrorEvent } from './store.utils';
import {
  prepareValidatedInputSignals,
  ValidatedInput,
  ValidatedInputSignals,
  ValidatedInputSignalsFactoryOptions,
} from './validated-input-signals.factory';

export type ValidatedInputWithResult<InputModel, ValidationResult, ResultModel> = ValidatedInput<
  InputModel,
  ValidationResult
> &
  InputWithResult<InputModel, ResultModel>;

export interface ValidatedInputWithResultSignals<InputModel, ValidationResult, ResultModel>
  extends ValidatedInputSignals<InputModel, ValidationResult>,
    InputWithResultSignals<InputModel, ResultModel> {
  readonly validatedInputWithResultBehaviorId: TypeIdentifier<
    ValidatedInputWithResult<InputModel, ValidationResult, ResultModel>
  >;
}

export type ValidatedInputWithResultSignalsFactoryOptions<
  InputModel,
  ValidationResult,
  ResultModel
> = ValidatedInputSignalsFactoryOptions<InputModel, ValidationResult> &
  InputWithResultSignalsFactoryOptions<InputModel, ResultModel>;

export const prepareValidatedInputWithResultSignals = <InputModel, ValidationResult, ResultModel>(
  inputObservableGetter: (store: Store) => Observable<InputModel>,
  validationEffect: EffectType<InputModel, ValidationResult>,
  resultEffect: EffectType<InputModel, ResultModel>,
  options: ValidatedInputWithResultSignalsFactoryOptions<
    InputModel,
    ValidationResult,
    ResultModel
  > = {},
): ValidatedInputWithResultSignals<InputModel, ValidationResult, ResultModel> => {
  const identifierNamePrefix = options.identifierNamePrefix ?? '';
  const validatedInputWithResultBehaviorId = getIdentifier<
    ValidatedInputWithResult<InputModel, ValidationResult, ResultModel>
  >(`${identifierNamePrefix}_ValidatedInputWithResult`);
  const inputWithResultBehaviorId = getIdentifier<InputWithResult<InputModel, ResultModel>>(
    `${identifierNamePrefix}_ValidatedInputWithResult`,
  );
  const unhandledResultEffectErrorEventId = getIdentifier<UnhandledEffectErrorEvent<InputModel>>(
    `${identifierNamePrefix}_EffectiveResultErrorEvent`,
  );

  const internalResultEffect: EffectType<
    ValidatedInput<InputModel, ValidationResult>,
    ResultModel
  > = (
    input: ValidatedInput<InputModel, ValidationResult>,
    store: Store,
    previousInput?: ValidatedInput<InputModel, ValidationResult>,
    previousResult?: ResultModel,
  ) => {
    if (!input.validationPending && input.validatedInput !== undefined && input.isValid) {
      return resultEffect(
        input.validatedInput,
        store,
        previousInput?.validatedInput,
        previousResult,
      );
    }
    return NEVER;
  };

  const validationFactory = prepareValidatedInputSignals<InputModel, ValidationResult>(
    inputObservableGetter,
    validationEffect,
    options,
  );
  const inputEquals: (prevInput?: InputModel, nextInput?: InputModel) => boolean =
    options.inputEquals ?? ((prev, next) => prev === next);
  const resultInputEquals = (
    prev?: ValidatedInput<InputModel, ValidationResult>,
    next?: ValidatedInput<InputModel, ValidationResult>,
  ) => inputEquals(prev?.validatedInput, next?.validatedInput);
  const resultFactory = prepareInputWithResultSignals<
    ValidatedInput<InputModel, ValidationResult>,
    ResultModel
  >(store => store.getBehavior(validationFactory.validatedInputBehaviorId), internalResultEffect, {
    ...options,
    inputDebounceTime: 0,
    inputEquals: resultInputEquals,
  });

  return {
    validatedInputBehaviorId: validationFactory.validatedInputBehaviorId,
    inputWithResultBehaviorId,
    validatedInputWithResultBehaviorId,
    validationPendingBehaviorId: validationFactory.validationPendingBehaviorId,
    isValidBehaviorId: validationFactory.isValidBehaviorId,
    unhandledValidationEffectErrorEventId: validationFactory.unhandledValidationEffectErrorEventId,
    resultPendingBehaviorId: resultFactory.resultPendingBehaviorId,
    invalidateResultEventId: resultFactory.invalidateResultEventId,
    triggerResultEffectEventId: resultFactory.triggerResultEffectEventId,
    unhandledResultEffectErrorEventId,
    setup: (store: Store) => {
      validationFactory.setup(store);
      resultFactory.setup(store);

      store.addEventSource(
        Symbol(''),
        unhandledResultEffectErrorEventId,
        store.getEventStream(resultFactory.unhandledResultEffectErrorEventId).pipe(
          map(event => ({
            input: event.input.validatedInput,
            error: event.error,
          })),
        ),
      );

      store.addLazyBehavior(
        validatedInputWithResultBehaviorId,
        store.getBehavior(resultFactory.inputWithResultBehaviorId).pipe(
          map(r => ({
            currentInput: r.currentInput?.currentInput,
            validatedInput: r.currentInput?.validatedInput,
            validationResult: r.currentInput?.validationResult,
            isValid: r.currentInput?.isValid ?? false,
            validationPending: r.currentInput?.validationPending ?? false,
            unhandledValidationEffectError: r.currentInput?.unhandledValidationEffectError ?? null,
            resultInput: r.resultInput?.validatedInput,
            result: r.result,
            resultPending:
              r.resultPending &&
              r.currentInput?.isValid === true &&
              r.currentInput?.validationPending === false,
            unhandledResultEffectError: r.unhandledResultEffectError,
          })),
          distinctUntilChanged(
            (a, b) =>
              a.currentInput === b.currentInput &&
              a.validationResult === b.validationResult &&
              a.isValid === b.isValid &&
              a.validationPending === b.validationPending &&
              a.unhandledValidationEffectError === b.unhandledValidationEffectError &&
              a.result === b.result &&
              a.resultPending === b.resultPending &&
              a.unhandledResultEffectError === b.unhandledResultEffectError &&
              inputEquals(a.validatedInput, b.validatedInput) &&
              inputEquals(a.resultInput, b.resultInput),
          ),
        ),
      );

      store.addLazyBehavior(
        inputWithResultBehaviorId,
        store.getBehavior(validatedInputWithResultBehaviorId).pipe(
          map(r => ({
            currentInput: r.currentInput,
            resultInput: r.resultInput,
            result: r.result,
            resultPending: r.resultPending,
            unhandledResultEffectError: r.unhandledResultEffectError,
          })),
          distinctUntilChanged(
            (a, b) =>
              a.currentInput === b.currentInput &&
              a.result === b.result &&
              a.resultPending === b.resultPending &&
              a.unhandledResultEffectError === b.unhandledResultEffectError &&
              inputEquals(a.resultInput, b.resultInput),
          ),
        ),
      );
    },
  };
};
