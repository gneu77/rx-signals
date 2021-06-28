import { NEVER, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  InputWithResult,
  InputWithResultSignalsFactoryOptions,
  prepareInputWithResultSignals,
} from './input-with-result-signals.factory';
import { Store, TypeIdentifier } from './store';
import { EffectType, getIdentifier, SignalsFactory } from './store.utils';
import {
  prepareValidatedInputSignals,
  ValidatedInput,
  ValidatedInputSignalsFactoryOptions,
} from './validated-input-signals.factory';

export type ValidatedInputWithResult<InputModel, ValidationResult, ResultModel> = ValidatedInput<
  InputModel,
  ValidationResult
> &
  InputWithResult<InputModel, ResultModel>;

export interface ValidatedInputWithResultSignals<InputModel, ValidationResult, ResultModel>
  extends SignalsFactory {
  readonly validatedInputWithResultBehaviorId: TypeIdentifier<
    ValidatedInputWithResult<InputModel, ValidationResult, ResultModel>
  >;
  readonly validationPendingBehaviorId: TypeIdentifier<boolean>;
  readonly isValidBehaviorId: TypeIdentifier<boolean>;
  readonly resultPendingBehaviorId: TypeIdentifier<boolean>;
  readonly invalidateResultEventId: TypeIdentifier<void>;
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

  const internalResultEffect: EffectType<
    ValidatedInput<InputModel, ValidationResult>,
    ResultModel
  > = (input: ValidatedInput<InputModel, ValidationResult>, store: Store) => {
    if (!input.validationPending && input.validatedInput !== undefined && input.isValid) {
      return resultEffect(input.validatedInput, store);
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
    inputEquals: resultInputEquals, // undefined,
  });

  return {
    validatedInputWithResultBehaviorId,
    validationPendingBehaviorId: validationFactory.validationPendingBehaviorId,
    isValidBehaviorId: validationFactory.isValidBehaviorId,
    resultPendingBehaviorId: resultFactory.resultPendingBehaviorId,
    invalidateResultEventId: resultFactory.invalidateResultEventId,
    setup: (store: Store) => {
      validationFactory.setup(store);
      resultFactory.setup(store);

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
        ),
      );
    },
  };
};
