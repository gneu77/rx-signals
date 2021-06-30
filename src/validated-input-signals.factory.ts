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
import {
  EffectType,
  getIdentifier,
  SignalsFactory,
  SignalsFactoryOptions,
  UnhandledEffectErrorEvent,
} from './store.utils';

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
  readonly unhandledValidationEffectErrorEventId: TypeIdentifier<
    UnhandledEffectErrorEvent<InputModel>
  >;
}

export interface ValidatedInputSignalsFactoryOptions<InputModel, ValidationResult>
  extends SignalsFactoryOptions<InputModel> {
  readonly isValid?: (validationResult?: ValidationResult) => boolean;
}

interface InternalRequest<InputModel, ValidationResult> {
  readonly input: InputModel | symbol;
  readonly validatedInput: InputModel | symbol;
  readonly validationResult: ValidationResult | symbol;
  readonly isValid: boolean;
  readonly unhandledValidationEffectError: any | null;
}

interface InternalResultEvent<InputModel, ValidationResult> {
  readonly validatedInput: InputModel;
  readonly unhandledValidationEffectError: any | null;
  readonly validationResult: ValidationResult | symbol;
  readonly isValid: boolean;
}

export const prepareValidatedInputSignals = <InputModel, ValidationResult>(
  inputObservableGetter: (store: Store) => Observable<InputModel>,
  validationEffect: EffectType<InputModel, ValidationResult>,
  options: ValidatedInputSignalsFactoryOptions<InputModel, ValidationResult> = {},
): ValidatedInputSignals<InputModel, ValidationResult> => {
  const inputEquals: (prevInput?: InputModel, nextInput?: InputModel) => boolean =
    options.inputEquals ?? ((prev, next) => prev === next);
  const internalRequestInputChanged: (a: InputModel | symbol, b: InputModel | symbol) => boolean = (
    input: InputModel | symbol,
    validatedInput: InputModel | symbol,
  ) =>
    input !== NO_VALUE &&
    (validatedInput === NO_VALUE ||
      !inputEquals(input as InputModel, validatedInput as InputModel));
  const identifierNamePrefix = options.identifierNamePrefix ?? '';
  const inputDebounceTime = options.inputDebounceTime ?? 10;
  const internalValidationEffect = (
    input: InputModel,
    store: Store,
    previousInput?: InputModel,
    previousResult?: ValidationResult,
  ) => {
    try {
      return validationEffect(input, store, previousInput, previousResult);
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
  const unhandledValidationEffectErrorEventId = getIdentifier<
    UnhandledEffectErrorEvent<InputModel>
  >(`${identifierNamePrefix}_ValidationErrorEvent`);

  const internalRequestBehaviorId = getIdentifier<InternalRequest<InputModel, ValidationResult>>();
  const internalRequestEventId = getIdentifier<InputModel | symbol>();
  const internalResultEventId = getIdentifier<InternalResultEvent<InputModel, ValidationResult>>();

  const initialInternalRequest: InternalRequest<InputModel, ValidationResult> = {
    input: NO_VALUE,
    validatedInput: NO_VALUE,
    validationResult: NO_VALUE,
    isValid: false,
    unhandledValidationEffectError: null,
  };

  return {
    validatedInputBehaviorId,
    validationPendingBehaviorId,
    isValidBehaviorId,
    unhandledValidationEffectErrorEventId,
    setup: (store: Store) => {
      store.addState(internalRequestBehaviorId, initialInternalRequest);
      store.addReducer(internalRequestBehaviorId, internalRequestEventId, (state, event) => ({
        ...state,
        input: event,
      }));
      store.addReducer(internalRequestBehaviorId, internalResultEventId, (state, event) => ({
        ...state,
        ...event,
      }));
      store.addEventSource(
        Symbol(''),
        unhandledValidationEffectErrorEventId,
        store.getEventStream(internalResultEventId).pipe(
          filter(event => event.unhandledValidationEffectError !== null),
          map(event => ({
            input: event.validatedInput,
            error: event.unhandledValidationEffectError,
          })),
        ),
      );
      store.addEventSource(
        Symbol(''),
        internalResultEventId,
        store.getBehavior(internalRequestBehaviorId).pipe(
          filter(state => state.input !== NO_VALUE),
          filter(state => internalRequestInputChanged(state.input, state.validatedInput)),
          switchMap(state =>
            internalValidationEffect(
              state.input as InputModel,
              store,
              state.validatedInput === NO_VALUE ? undefined : (state.validatedInput as InputModel),
              state.validationResult === NO_VALUE
                ? undefined
                : (state.validationResult as ValidationResult),
            ).pipe(
              map(validationResult => ({
                validatedInput: state.input as InputModel,
                validationResult,
                isValid: isValidationResultValid(validationResult),
                unhandledValidationEffectError: null,
              })),
              catchError(error =>
                of({
                  validatedInput: state.input as InputModel,
                  validationResult: NO_VALUE,
                  isValid: false,
                  unhandledValidationEffectError: error,
                }),
              ),
            ),
          ),
        ),
      );

      const combinedInput = combineLatest([
        inputObservableGetter(store).pipe(distinctUntilChanged(), debounceTime(inputDebounceTime)),
        store.getBehavior(internalRequestBehaviorId),
      ]);

      store.addLazyBehavior(
        validatedInputBehaviorId,
        combinedInput.pipe(
          map(([input, state]) => {
            if (internalRequestInputChanged(input, state.input)) {
              store.dispatchEvent(internalRequestEventId, input);
            }
            return {
              currentInput: input,
              validatedInput:
                state.validatedInput === NO_VALUE
                  ? undefined
                  : (state.validatedInput as InputModel),
              validationResult:
                state.validationResult === NO_VALUE
                  ? undefined
                  : (state.validationResult as ValidationResult),
              isValid: state.isValid,
              validationPending: internalRequestInputChanged(input, state.validatedInput),
              unhandledValidationEffectError: state.unhandledValidationEffectError,
            };
          }),
          distinctUntilChanged(
            (a, b) =>
              a.validationResult === b.validationResult &&
              a.isValid === b.isValid &&
              a.validationPending === b.validationPending &&
              a.unhandledValidationEffectError === b.unhandledValidationEffectError &&
              a.currentInput === b.currentInput &&
              inputEquals(a.validatedInput, b.validatedInput),
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
