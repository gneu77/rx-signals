import { Observable, combineLatest, distinctUntilChanged, filter, map, startWith } from 'rxjs';
import {
  CombinedEffectResult,
  CombinedEffectResultInSuccessState,
  EffectCompletedSuccess,
  EffectError,
  EffectOutputSignals,
  EffectSuccess,
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
} from './store-utils';
import { Merged } from './type-utils';

/**
 * This specifies the type for the lazy combined-behavior provided as output-signal of the {@link ValidatedInputWithResultFactory}.
 *
 * @template Input - specifies the input type for both, the validation-effect and the result-effect
 * @template ValidationResult - specifies the result-type of the validation-effect
 * @template Result - specifies the result-type of the result-effect
 */
export type ValidatedInputWithResult<Input, ValidationResult, Result> = {
  /** current input (which might differ from the resultInput) */
  currentInput: Input | NoValueType;

  /** indicates whether the validation-effect is currently running */
  validationPending: boolean;

  /** the input that produced the current validationResult (or NO_VALUE, if validationResult is NO_VALUE) */
  validatedInput: Input | NoValueType;

  /** the current validationResult (or NO_VALUE, if no validation-result was received yet) */
  validationResult: ValidationResult | NoValueType;

  /** only true if validationResult represents a valid state AND validationPending is false */
  isValid: boolean;

  /** indicates whether the result-effect is currently running */
  resultPending: boolean;

  /** the input that produced the current result (or NoValueType, if result is NO_VALUE) */
  resultInput: Input | NoValueType;

  /* In case the resultInput led to an error (result === NO_VALUE in that case) */
  resultError?: any;

  /** the current result (or NO_VALUE, if no result was received yet) */
  result: Result | NoValueType;
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
export type ValidatedInputWithResultOutput<Input, ValidationResult, Result> = {
  combined: DerivedId<ValidatedInputWithResult<Input, ValidationResult, Result>>;
  result: DerivedId<CombinedEffectResultInSuccessState<Input, Result>>;
  validationErrors: EventId<EffectError<Input>>;
  validationSuccesses: EventId<EffectSuccess<Input, ValidationResult>>;
  validationCompletedSuccesses: EventId<EffectCompletedSuccess<Input, ValidationResult>>;
  resultErrors: EventId<EffectError<Input>>;
  resultSuccesses: EventId<EffectSuccess<Input, Result>>;
  resultCompletedSuccesses: EventId<EffectCompletedSuccess<Input, Result>>;
};

/**
 * The analog to {@link EffectConfiguration}, just for {@link ValidatedInputWithResultFactory}.
 */
export type ValidatedInputWithResultConfig<Input, ValidationResult, Result> = {
  isValidationResultValid?: (validationResult: ValidationResult) => boolean;
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
export type ValidatedInputWithResultEffects<Input, ValidationResult, Result> = {
  validation: EffectId<Input, ValidationResult>;
  result: EffectId<Input, Result>;
};

/**
 * The ValidatedInputWithResultFactory is composed of two {@link EffectSignalsFactory}s, to abstract over all
 * scenarios where you need to validate a certain input and run a result-effect only if the validation
 * has passed successfully.
 */
export type ValidatedInputWithResultFactory<Input, ValidationResult, Result> = SignalsFactory<
  ValidatedInputWithResultInput<Input>,
  ValidatedInputWithResultOutput<Input, ValidationResult, Result>,
  ValidatedInputWithResultConfig<Input, ValidationResult, Result>,
  ValidatedInputWithResultEffects<Input, ValidationResult, Result>
>;

type ResultInputGetterInput<Input, ValidationResult> = {
  currentInput: Input;
  resultInput: Input;
  result: ValidationResult;
  resultPending: boolean;
};

const isResultInputGetterInput = <Input, ValidationResult>(
  c: CombinedEffectResult<Input, ValidationResult>, // from the validation effect
): c is ResultInputGetterInput<Input, ValidationResult> =>
  !c.resultPending &&
  c.resultInput !== NO_VALUE &&
  c.result !== NO_VALUE &&
  c.currentInput === c.resultInput;

const resultInputGetter = <Input, ValidationResult>(
  store: Store,
  validationBehaviorId: BehaviorId<CombinedEffectResult<Input, ValidationResult>>,
  isValidationResultValid: (validationResult: ValidationResult) => boolean,
): Observable<Input> =>
  store.getBehavior(validationBehaviorId).pipe(
    filter(isResultInputGetterInput),
    filter(c => isValidationResultValid(c.result)),
    map(c => c.resultInput),
    distinctUntilChanged(),
  );

const mapBehaviors = <Input, ValidationResult, Result>(
  [v, r]: [CombinedEffectResult<Input, ValidationResult>, CombinedEffectResult<Input, Result>],
  isValidationResultValid: (validationResult: ValidationResult) => boolean,
) => ({
  currentInput: v.currentInput,
  validationPending: v.resultPending,
  validatedInput: v.resultInput,
  validationResult: v.result,
  isValid: !v.resultPending && v.result !== NO_VALUE ? isValidationResultValid(v.result) : false,
  resultPending: r.resultPending,
  resultInput: r.resultInput,
  ...(r.resultError ? { resultError: r.resultError } : {}),
  result: r.result,
});

const setupCombinedBehavior = <Input, ValidationResult, Result>(
  store: Store,
  outIds: Merged<EffectOutputSignals<Input, ValidationResult>, EffectOutputSignals<Input, Result>>,
  id: DerivedId<ValidatedInputWithResult<Input, ValidationResult, Result>>,
  isValidationResultValid: (validationResult: ValidationResult) => boolean,
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
          v.result === NO_VALUE ||
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
          a.resultError === b.resultError &&
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
>(): ValidatedInputWithResultFactory<Input, ValidationResult, Result> =>
  getEffectSignalsFactory<Input, ValidationResult>()
    .renameEffectId('id', 'validation')
    .compose(getEffectSignalsFactory<Input, Result>())
    .renameEffectId('id', 'result')
    .mapConfig((config: ValidatedInputWithResultConfig<Input, ValidationResult, Result>) => ({
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
    }))
    .extendSetup((store, inIds, outIds, config) => {
      store.connectObservable(
        resultInputGetter(
          store,
          outIds.conflicts1.combined,
          config.isValidationResultValid ?? (validationResult => validationResult === null),
        ),
        inIds.conflicts2.input,
      );
    })
    .addOutputId('combined', config =>
      getDerivedId<ValidatedInputWithResult<Input, ValidationResult, Result>>(
        `${config.nameExtension ?? ''}_combined`,
      ),
    )
    .extendSetup((store, _, output, config) => {
      setupCombinedBehavior(
        store,
        output,
        output.combined,
        config.isValidationResultValid ?? (validationResult => validationResult === null),
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
      result: output.conflicts2.result,
      validationErrors: output.conflicts1.errors,
      validationSuccesses: output.conflicts1.successes,
      validationCompletedSuccesses: output.conflicts1.completedSuccesses,
      resultErrors: output.conflicts2.errors,
      resultSuccesses: output.conflicts2.successes,
      resultCompletedSuccesses: output.conflicts2.completedSuccesses,
    }));
