import { combineLatest } from 'rxjs';
import { distinctUntilChanged, filter, map, startWith } from 'rxjs/operators';
import {
  CombinedEffectResult,
  EffectError,
  EffectOutputSignals,
  EffectSuccess,
  getEffectSignalsFactory,
} from './effect-signals-factory';
import { SignalsFactory } from './signals-factory';
import { Store } from './store';
import { BehaviorId, EffectId, EventId, getBehaviorId } from './store-utils';
import { Merged } from './type-utils';

/**
 * This specifies the type for the lazy combined-behavior provided as output-signal of the ValidatedInputWithResultFactory.
 *
 * @typedef {object} ValidatedInputWithResult<InputType, ValidationType, ResultType> - type for the behavior produced by ValidatedInputWithResultFactory
 * @template InputType - specifies the input type for both, the validation-effect and the result-effect
 * @template ValidationType - specifies the result-type of the validation-effect
 * @template ResultType - specifies the result-type of the result-effect
 * @property {InputType | undefined} currentInput - current input (which might differ from the resultInput)
 * @property {InputType | undefined} validatedInput - the input that produced the current validationResult (or undefined, if validationResult is undefined)
 * @property {ValidationType | undefined} validationResult - the current validationResult (or undefined, if no validation-result was received yet)
 * @property {boolean} validationPending - indicates whether the validation-effect is currently running.
 * @property {InputType | undefined} resultInput - the input that produced the current result (or undefined, if result is undefined)
 * @property {ResultType | undefined} result - the current result (or undefined, if no result was received yet)
 * @property {boolean} resultPending - indicates whether the result-effect is currently running.
 */
export type ValidatedInputWithResult<InputType, ValidationType, ResultType> = {
  currentInput?: InputType;
  validationPending: boolean;
  validatedInput?: InputType;
  validationResult?: ValidationType;
  isValid: boolean;
  resultPending: boolean;
  resultInput?: InputType;
  result?: ResultType;
};

/**
 * The analog to EffectInputSignals, just for ValidatedInputWithResultFactory.
 */
export type ValidatedInputWithResultInput<InputType> = {
  input: BehaviorId<InputType>;
  validationInvalidate: EventId<void>;
  resultInvalidate: EventId<void>;
  resultTrigger: EventId<void>;
};

/**
 * The analog to EffectOutputSignals, just for ValidatedInputWithResultFactory.
 */
export type ValidatedInputWithResultOutput<InputType, ValidationType, ResultType> = {
  combined: BehaviorId<ValidatedInputWithResult<InputType, ValidationType, ResultType>>;
  validationErrors: EventId<EffectError<InputType>>;
  validationSuccesses: EventId<EffectSuccess<InputType, ValidationType>>;
  resultErrors: EventId<EffectError<InputType>>;
  resultSuccesses: EventId<EffectSuccess<InputType, ResultType>>;
};

/**
 * The analog to EffectConfiguration, just for ValidatedInputWithResultFactory.
 */
export type ValidatedInputWithResultConfig<InputType, ValidationType, ResultType> = {
  validationEffectId: EffectId<InputType, ValidationType>;
  isValidationResultValid?: (validationResult: ValidationType) => boolean;
  validationEffectDebounceTime?: number;
  resultEffectId: EffectId<InputType, ResultType>;
  resultEffectDebounceTime?: number;
  initialResultGetter?: () => ResultType;
  withResultTrigger?: boolean;
  resultEffectInputEquals?: (a: InputType, b: InputType) => boolean;
};

/**
 * The ValidatedInputWithResultFactory is composed of two EffectSignalsFactory, to abstract over all
 * scenarios where you need to validate a certain input and run a result-effect only if the validation
 * has passed successfully.
 */
export type ValidatedInputWithResultFactory<InputType, ValidationType, ResultType> = SignalsFactory<
  ValidatedInputWithResultInput<InputType>,
  ValidatedInputWithResultOutput<InputType, ValidationType, ResultType>,
  ValidatedInputWithResultConfig<InputType, ValidationType, ResultType>
>;

const resultInputGetter = <InputType, ValidationType>(
  store: Store,
  validationBehaviorId: BehaviorId<CombinedEffectResult<InputType, ValidationType>>,
  isValidationResultValid: (validationResult: ValidationType) => boolean,
) =>
  store.getBehavior(validationBehaviorId).pipe(
    filter(c => c.resultInput !== undefined && c.result !== undefined),
    filter(c => c.currentInput === c.resultInput),
    filter(c => isValidationResultValid(c.result as ValidationType)), // cast is OK, cause we checked for undefined in the first filter
    map(c => c.resultInput),
    distinctUntilChanged(),
    map(resultInput => resultInput as InputType), // cast is OK, cause we checked for undefined in the first filter
  );

const mapBehaviors = <InputType, ValidationType, ResultType>(
  [v, r]: [
    CombinedEffectResult<InputType, ValidationType>,
    CombinedEffectResult<InputType, ResultType>,
  ],
  isValidationResultValid: (validationResult: ValidationType) => boolean,
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

const setupCombinedBehavior = <InputType, ValidationType, ResultType>(
  store: Store,
  outIds: Merged<
    EffectOutputSignals<InputType, ValidationType>,
    EffectOutputSignals<InputType, ResultType>
  >,
  id: BehaviorId<ValidatedInputWithResult<InputType, ValidationType, ResultType>>,
  isValidationResultValid: (validationResult: ValidationType) => boolean,
  initialResultGetter?: () => ResultType,
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
 * Generic function to create a specific ValidatedInputWithResultFactory.
 */
export const getValidatedInputWithResultSignalsFactory = <
  InputType,
  ValidationType,
  ResultType,
>(): ValidatedInputWithResultFactory<InputType, ValidationType, ResultType> =>
  getEffectSignalsFactory<InputType, ValidationType>()
    .compose(getEffectSignalsFactory<InputType, ResultType>())
    .mapConfig((config: ValidatedInputWithResultConfig<InputType, ValidationType, ResultType>) => ({
      c1: {
        effectId: config.validationEffectId,
        effectDebounceTime: config.validationEffectDebounceTime,
      },
      c2: {
        effectId: config.resultEffectId,
        initialResultGetter: config.initialResultGetter,
        withTrigger: config.withResultTrigger,
        effectInputEquals: config.resultEffectInputEquals,
        effectDebounceTime: config.resultEffectDebounceTime,
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
        true,
      );
    })
    .addOrReplaceOutputId('combined', () =>
      getBehaviorId<ValidatedInputWithResult<InputType, ValidationType, ResultType>>(),
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
