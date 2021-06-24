import { combineLatest, Observable, of, throwError } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  switchMap,
} from 'rxjs/operators';
import { NO_VALUE } from './source-observable';
import { Store, TypeIdentifier } from './store';
import { EffectType, getIdentifier, SignalsFactory, SignalsFactoryOptions } from './store.utils';

export interface ValidatedInput<InputModel, ValidationResult> {
  readonly currentInput?: InputModel;
  readonly validatedInput?: InputModel;
  readonly validationResult?: ValidationResult;
  readonly isValid: boolean;
  readonly validationPending: boolean; // true, if the current input differs from validatedInput
  readonly unhandledValidationEffectError: any | null;
}

export interface ValidatedInputSignals<InputModel, ValidationResult> extends SignalsFactory {
  readonly validatedInputBehaviorId: TypeIdentifier<ValidatedInput<InputModel, ValidationResult>>;
  readonly validationPendingBehaviorId: TypeIdentifier<boolean>;
  readonly isValidBehaviorId: TypeIdentifier<boolean>;
}

export interface ValidatedInputSignalsFactoryOptions<InputModel, ValidationResult>
  extends SignalsFactoryOptions<InputModel> {
  readonly isValid?: (validationResult?: ValidationResult) => boolean;
}

interface InternalResult<InputModel, ValidationResult> {
  readonly validatedInput: InputModel | symbol;
  readonly validationResult?: ValidationResult;
  readonly isValid: boolean;
  readonly unhandledValidationEffectError: any | null;
}

export const prepareValidatedInputSignals = <InputModel, ValidationResult>(
  inputObservableGetter: (store: Store) => Observable<InputModel>,
  validationEffect: EffectType<InputModel, ValidationResult>,
  options: ValidatedInputSignalsFactoryOptions<InputModel, ValidationResult> = {},
): ValidatedInputSignals<InputModel, ValidationResult> => {
  const inputEquals: (prevInput?: InputModel, nextInput?: InputModel) => boolean =
    options.inputEquals ?? ((prev, next) => prev === next);
  const internalInputEquals = (newInput?: InputModel, stateInput?: InputModel | symbol) =>
    stateInput === newInput ||
    (stateInput !== NO_VALUE && inputEquals(stateInput as InputModel, newInput));
  const identifierNamePrefix = options.identifierNamePrefix ?? '';
  const inputDebounceTime = options.inputDebounceTime ?? 30;
  const internalValidationEffect = (input: InputModel, store: Store) => {
    try {
      return validationEffect(input, store);
    } catch (error) {
      return throwError(error);
    }
  };

  const isValidationResultValid: (vr?: ValidationResult) => boolean =
    (options.isValid ?? null) === null
      ? (vr?: ValidationResult) => (vr ?? null) === null
      : (options.isValid as (vr?: ValidationResult) => boolean);

  const validatedInputBehaviorId = getIdentifier<ValidatedInput<InputModel, ValidationResult>>(
    `${identifierNamePrefix}_ValidatedInput`,
  );
  const validationPendingBehaviorId = getIdentifier<boolean>(
    `${identifierNamePrefix}_ValidationPending`,
  );
  const isValidBehaviorId = getIdentifier<boolean>(`${identifierNamePrefix}_IsValid`);

  const internalResultBehaviorId = getIdentifier<InternalResult<InputModel, ValidationResult>>(
    `${identifierNamePrefix}_InternalResult`,
  );

  const initialInternalResult: InternalResult<InputModel, ValidationResult> = {
    validatedInput: NO_VALUE,
    isValid: false,
    unhandledValidationEffectError: null,
  };

  return {
    validatedInputBehaviorId,
    validationPendingBehaviorId,
    isValidBehaviorId,
    setup: (store: Store) => {
      const combinedInput = combineLatest([
        inputObservableGetter(store).pipe(distinctUntilChanged(), debounceTime(inputDebounceTime)),
        store.getBehavior(internalResultBehaviorId),
      ]);

      store.addLazyBehavior(
        internalResultBehaviorId,
        combinedInput.pipe(
          filter(([input, state]) => !internalInputEquals(input, state.validatedInput)),
          switchMap(([input]) =>
            internalValidationEffect(input, store).pipe(
              map(validationResult => ({
                validatedInput: input,
                validationResult,
                isValid: isValidationResultValid(validationResult),
                unhandledValidationEffectError: null,
              })),
              catchError(error =>
                of({
                  validatedInput: input,
                  isValid: false,
                  unhandledValidationEffectError: error,
                }),
              ),
            ),
          ),
        ),
        initialInternalResult,
      );

      store.addLazyBehavior(
        validatedInputBehaviorId,
        combinedInput.pipe(
          map(([input, state]) => ({
            currentInput: input,
            validatedInput:
              state.validatedInput === NO_VALUE ? undefined : (state.validatedInput as InputModel),
            validationResult:
              state.validatedInput === NO_VALUE ? undefined : state.validationResult,
            isValid: state.isValid,
            validationPending: !internalInputEquals(input, state.validatedInput),
            unhandledValidationEffectError: state.unhandledValidationEffectError,
          })),
          distinctUntilChanged(
            (a, b) =>
              a.isValid === b.isValid &&
              a.validationResult === b.validationResult &&
              a.validationPending === b.validationPending &&
              a.unhandledValidationEffectError === b.unhandledValidationEffectError &&
              a.currentInput === b.currentInput &&
              internalInputEquals(a.validatedInput, b.validatedInput),
          ),
        ),
      );

      store.addLazyBehavior(
        validationPendingBehaviorId,
        store.getBehavior(validatedInputBehaviorId).pipe(map(r => r.validationPending)),
      );

      store.addLazyBehavior(
        isValidBehaviorId,
        store.getBehavior(validatedInputBehaviorId).pipe(map(r => r.isValid)),
      );
    },
  };
};
