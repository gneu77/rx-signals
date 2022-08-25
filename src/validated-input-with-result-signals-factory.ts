import { combineLatest, distinctUntilChanged, filter, map, startWith } from 'rxjs';
import {
  CombinedEffectResult,
  EffectError,
  EffectOutputSignals,
  EffectSuccess,
  getEffectSignalsFactory,
} from './effect-signals-factory';
import { SignalsFactory } from './signals-factory';
import { Store } from './store';
import { BehaviorId, DerivedId, EffectId, EventId, getDerivedId } from './store-utils';
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
  currentInput?: Input;

  /** indicates whether the validation-effect is currently running */
  validationPending: boolean;

  /** the input that produced the current validationResult (or undefined, if validationResult is undefined) */
  validatedInput?: Input;

  /** the current validationResult (or undefined, if no validation-result was received yet) */
  validationResult?: ValidationResult;

  /** whether the current validationResult represents a valid state (false, if current validationResult is undefined) */
  isValid: boolean;

  /** indicates whether the result-effect is currently running */
  resultPending: boolean;

  /** the input that produced the current result (or undefined, if result is undefined) */
  resultInput?: Input;

  /** the current result (or undefined, if no result was received yet) */
  result?: Result;
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
  validationErrors: EventId<EffectError<Input>>;
  validationSuccesses: EventId<EffectSuccess<Input, ValidationResult>>;
  resultErrors: EventId<EffectError<Input>>;
  resultSuccesses: EventId<EffectSuccess<Input, Result>>;
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

const resultInputGetter = <Input, ValidationResult>(
  store: Store,
  validationBehaviorId: BehaviorId<CombinedEffectResult<Input, ValidationResult>>,
  isValidationResultValid: (validationResult: ValidationResult) => boolean,
) =>
  store.getBehavior(validationBehaviorId).pipe(
    filter(c => c.resultInput !== undefined && c.result !== undefined),
    filter(c => c.currentInput === c.resultInput),
    filter(c => isValidationResultValid(c.result as ValidationResult)), // cast is OK, cause we checked for undefined in the first filter
    map(c => c.resultInput),
    distinctUntilChanged(),
    map(resultInput => resultInput as Input), // cast is OK, cause we checked for undefined in the first filter
  );

const mapBehaviors = <Input, ValidationResult, Result>(
  [v, r]: [CombinedEffectResult<Input, ValidationResult>, CombinedEffectResult<Input, Result>],
  isValidationResultValid: (validationResult: ValidationResult) => boolean,
) => ({
  currentInput: v.currentInput,
  validationPending: v.resultPending,
  validatedInput: v.resultInput,
  validationResult: v.result,
  isValid: v.result !== undefined ? isValidationResultValid(v.result) : false,
  resultPending: r.resultPending,
  resultInput: r.resultInput,
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
          currentInput: undefined,
          resultInput: undefined,
          result: initialResultGetter ? initialResultGetter() : undefined,
          resultPending: false,
        }),
      ),
    ]).pipe(
      filter(
        ([v, r]) =>
          v.resultPending ||
          r.currentInput === v.resultInput ||
          v.result === undefined ||
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
      validationErrors: output.conflicts1.errors,
      validationSuccesses: output.conflicts1.successes,
      resultErrors: output.conflicts2.errors,
      resultSuccesses: output.conflicts2.successes,
    }));
