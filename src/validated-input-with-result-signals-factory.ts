import { Observable, combineLatest, distinctUntilChanged, filter, map, startWith } from 'rxjs';
import {
  CombinedEffectResult,
  EffectCompletedResultEvent,
  EffectOutputSignals,
  EffectResultEvent,
  SafeEffectResult,
  getEffectSignalsFactory,
} from './effect-signals-factory';
import { SignalsFactory } from './signals-factory';
import { Store } from './store';
import {
  BehaviorId,
  DerivedId,
  EffectId,
  EventId,
  NO_VALUE,
  NoValueType,
  getDerivedId,
  isNoValueType,
  isNotNoValueType,
} from './store-utils';
import { Merged } from './type-utils';

/**
 * This specifies the type for the lazy combined-behavior provided as output-signal of the {@link ValidatedInputWithResultFactory}.
 *
 * @template Input - specifies the input type for both, the validation-effect and the result-effect
 * @template ValidationResult - specifies the result-type of the validation-effect
 * @template Result - specifies the result-type of the result-effect
 * @template ValidationError - specifies the error type of the validation-effect
 * @template ResultError - specifies the error type of the result-effect
 */
export type ValidatedInputWithResult<
  Input,
  ValidationResult,
  Result,
  ValidationError,
  ResultError,
> = {
  /** current input (which might differ from the resultInput) */
  currentInput: Input | NoValueType;

  /** indicates whether the validation-effect is currently running */
  validationPending: boolean;

  /** the input that produced the current validationResult (or NO_VALUE, if validationResult is NO_VALUE) */
  validatedInput: Input | NoValueType;

  /** the current validationResult (or NO_VALUE, if no validation-result was received yet) */
  validationResult: SafeEffectResult<ValidationResult, ValidationError> | NoValueType;

  /** only true if validationResult represents a valid state AND validationPending is false */
  isValid: boolean;

  /** indicates whether the result-effect is currently running */
  resultPending: boolean;

  /** the input that produced the current result (or NoValueType, if result is NO_VALUE) */
  resultInput: Input | NoValueType;

  /** the current result (or NO_VALUE, if no result was received yet) */
  result: SafeEffectResult<Result, ResultError> | NoValueType;
};

/**
 * The analog to {@link EffectInputSignals}, just for {@link ValidatedInputWithResultFactory}.
 */
export type ValidatedInputWithResultInput<Input> = {
  input: DerivedId<Input>;
  validationInvalidate: EventId<undefined>;
  resultInvalidate: EventId<undefined>;
  resultTrigger: EventId<undefined>;
};

/**
 * The analog to {@link EffectOutputSignals}, just for {@link ValidatedInputWithResultFactory}.
 */
export type ValidatedInputWithResultOutput<
  Input,
  ValidationResult,
  Result,
  ValidationError,
  ResultError,
> = {
  combined: DerivedId<
    ValidatedInputWithResult<Input, ValidationResult, Result, ValidationError, ResultError>
  >;
  validationResults: EventId<EffectResultEvent<Input, ValidationResult, ValidationError>>;
  validationCompletedResults: EventId<
    EffectCompletedResultEvent<Input, ValidationResult, ValidationError>
  >;
  results: EventId<EffectResultEvent<Input, Result, ResultError>>;
  completedResults: EventId<EffectCompletedResultEvent<Input, Result, ResultError>>;
};

/**
 * The analog to {@link EffectConfiguration}, just for {@link ValidatedInputWithResultFactory}.
 */
export type ValidatedInputWithResultConfig<Input, ValidationResult, Result, ValidationError> = {
  /** whether the a validation result represents a valid state, defaults to `isNotEffectError(validationResult) && (validationResult ?? null) === null` */
  isValidationResultValid?: (
    validationResult: SafeEffectResult<ValidationResult, ValidationError>,
  ) => boolean;
  validationEffectDebounceTime?: number;
  resultEffectDebounceTime?: number;
  initialResultGetter?: () => Result;
  withResultTrigger?: boolean;
  resultEffectInputEquals?: (a: Input, b: Input) => boolean;
  eagerInputSubscription?: boolean;
  nameExtension?: string;
};

/**
 * The analog to {@link EffectFactoryEffects}, just for {@link ValidatedInputWithResultFactory}.
 */
export type ValidatedInputWithResultEffects<
  Input,
  ValidationResult,
  Result,
  ValidationError,
  ResultError,
> = {
  validation: EffectId<Input, ValidationResult, ValidationError>;
  result: EffectId<Input, Result, ResultError>;
};

/**
 * The ValidatedInputWithResultFactory is composed of two {@link EffectSignalsFactory}s, to abstract over all
 * scenarios where you need to validate a certain input and run a result-effect only if the validation
 * has passed successfully.
 */
export type ValidatedInputWithResultFactory<
  Input,
  ValidationResult,
  Result,
  ValidationError,
  ResultError,
> = SignalsFactory<
  ValidatedInputWithResultInput<Input>,
  ValidatedInputWithResultOutput<Input, ValidationResult, Result, ValidationError, ResultError>,
  ValidatedInputWithResultConfig<Input, ValidationResult, Result, ValidationError>,
  ValidatedInputWithResultEffects<Input, ValidationResult, Result, ValidationError, ResultError>
>;

type ResultInputGetterInput<Input, ValidationResult, ValidationError> = {
  currentInput: Input;
  resultInput: Input;
  result: SafeEffectResult<ValidationResult, ValidationError>;
  resultPending: boolean;
};

const isResultInputGetterInput = <Input, ValidationResult, ValidationError>(
  c: CombinedEffectResult<Input, ValidationResult, ValidationError>,
): c is ResultInputGetterInput<Input, ValidationResult, ValidationError> =>
  !c.resultPending &&
  isNotNoValueType(c.resultInput) &&
  isNotNoValueType(c.result) &&
  c.currentInput === c.resultInput;

const resultInputGetter = <Input, ValidationResult, ValidationError>(
  store: Store,
  validationBehaviorId: BehaviorId<CombinedEffectResult<Input, ValidationResult, ValidationError>>,
  isValidationResultValid: (
    validationResult: SafeEffectResult<ValidationResult, ValidationError>,
  ) => boolean,
): Observable<Input> =>
  store.getBehavior(validationBehaviorId).pipe(
    filter(isResultInputGetterInput),
    filter(c => isValidationResultValid(c.result)),
    map(c => c.resultInput),
    distinctUntilChanged(),
  );

const mapBehaviors = <Input, ValidationResult, Result, ValidationError, ResultError>(
  [v, r]: [
    CombinedEffectResult<Input, ValidationResult, ValidationError>,
    CombinedEffectResult<Input, Result, ResultError>,
  ],
  isValidationResultValid: (
    validationResult: SafeEffectResult<ValidationResult, ValidationError>,
  ) => boolean,
) => ({
  currentInput: v.currentInput,
  validationPending: v.resultPending,
  validatedInput: v.resultInput,
  validationResult: v.result,
  isValid:
    !v.resultPending && isNotNoValueType(v.result) ? isValidationResultValid(v.result) : false,
  resultPending: r.resultPending,
  resultInput: r.resultInput,
  result: r.result,
});

const setupCombinedBehavior = <Input, ValidationResult, Result, ValidationError, ResultError>(
  store: Store,
  outIds: Merged<
    EffectOutputSignals<Input, ValidationResult, ValidationError>,
    EffectOutputSignals<Input, Result, ResultError>
  >,
  id: DerivedId<
    ValidatedInputWithResult<Input, ValidationResult, Result, ValidationError, ResultError>
  >,
  isValidationResultValid: (
    validationResult: SafeEffectResult<ValidationResult, ValidationError>,
  ) => boolean,
  initialResultGetter?: () => Result,
) => {
  store.addDerivedState(
    id,
    combineLatest([
      store.getBehavior(outIds.conflicts1.combined),
      store.getBehavior(outIds.conflicts2.combined).pipe(
        startWith({
          currentInput: NO_VALUE,
          resultInput: NO_VALUE,
          result: initialResultGetter ? initialResultGetter() : NO_VALUE,
          resultPending: false,
        }),
      ),
    ]).pipe(
      filter(
        ([v, r]) =>
          v.resultPending ||
          r.currentInput === v.resultInput ||
          isNoValueType(v.result) ||
          !isValidationResultValid(v.result),
      ),
      map(pair => mapBehaviors(pair, isValidationResultValid)),
      distinctUntilChanged(
        (a, b) =>
          a.currentInput === b.currentInput &&
          a.isValid === b.isValid &&
          a.result === b.result &&
          a.resultInput === b.resultInput &&
          a.resultPending === b.resultPending &&
          a.validatedInput === b.validatedInput &&
          a.validationPending === b.validationPending &&
          a.validationResult === b.validationResult,
      ),
    ),
  );
};

/**
 * Generic function to create a specific {@link ValidatedInputWithResultFactory}.
 */
export const getValidatedInputWithResultSignalsFactory = <
  Input,
  ValidationResult,
  Result,
  ValidationError,
  ResultError,
>(): ValidatedInputWithResultFactory<
  Input,
  ValidationResult,
  Result,
  ValidationError,
  ResultError
> =>
  getEffectSignalsFactory<Input, ValidationResult, ValidationError>()
    .renameEffectId('id', 'validation')
    .compose(getEffectSignalsFactory<Input, Result, ResultError>())
    .renameEffectId('id', 'result')
    .mapConfig(
      (
        config: ValidatedInputWithResultConfig<Input, ValidationResult, Result, ValidationError>,
      ) => ({
        c1: {
          effectDebounceTime: config.validationEffectDebounceTime,
          eagerInputSubscription: config.eagerInputSubscription,
          nameExtension: `${config.nameExtension ?? ''}_validation`,
        },
        c2: {
          initialResultGetter: config.initialResultGetter,
          withTrigger: config.withResultTrigger,
          effectInputEquals: config.resultEffectInputEquals,
          effectDebounceTime: config.resultEffectDebounceTime,
          nameExtension: `${config.nameExtension ?? ''}_result`,
        },
      }),
    )
    .extendSetup(({ store, input, output, config }) => {
      store.connectObservable(
        resultInputGetter(
          store,
          output.conflicts1.combined,
          config.isValidationResultValid ?? (validationResult => validationResult === null),
        ),
        input.conflicts2.input,
      );
    })
    .addOutputId('combined', config =>
      getDerivedId<
        ValidatedInputWithResult<Input, ValidationResult, Result, ValidationError, ResultError>
      >(`${config.nameExtension ?? ''}_combined`),
    )
    .extendSetup(({ store, output, config }) => {
      setupCombinedBehavior(
        store,
        output,
        output.combined,
        config.isValidationResultValid ?? (validationResult => (validationResult ?? null) === null),
        config.initialResultGetter,
      );
    })
    .mapInput(input => ({
      input: input.conflicts1.input,
      validationInvalidate: input.conflicts1.invalidate,
      resultInvalidate: input.conflicts2.invalidate,
      resultTrigger: input.conflicts2.trigger,
    }))
    .mapOutput(output => ({
      combined: output.combined,
      validationResults: output.conflicts1.results,
      validationCompletedResults: output.conflicts1.completedResults,
      results: output.conflicts2.results,
      completedResults: output.conflicts2.completedResults,
    }));
