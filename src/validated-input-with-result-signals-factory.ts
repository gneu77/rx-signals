import { combineLatest } from 'rxjs';
import { distinctUntilChanged, filter, map, startWith } from 'rxjs/operators';
import {
  CombinedEffectResult,
  Effect,
  EffectError,
  EffectOutputSignals,
  EffectSuccess,
  getEffectSignalsFactory,
} from './effect-signals-factory';
import { SignalsFactory } from './signals-factory';
import { Store } from './store';
import { BehaviorId, EventId, getBehaviorId } from './store-utils';
import { Merged } from './type-utils';

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

export type ValidatedInputWithResultInput<InputType> = {
  input: BehaviorId<InputType>;
  validationInvalidate: EventId<void>;
  resultInvalidate: EventId<void>;
  resultTrigger: EventId<void>;
};

export type ValidatedInputWithResultOutput<InputType, ValidationType, ResultType> = {
  combined: BehaviorId<ValidatedInputWithResult<InputType, ValidationType, ResultType>>;
  validationErrors: EventId<EffectError<InputType>>;
  validationSuccesses: EventId<EffectSuccess<InputType, ValidationType>>;
  resultErrors: EventId<EffectError<InputType>>;
  resultSuccesses: EventId<EffectSuccess<InputType, ResultType>>;
};

export type ValidatedInputWithResultConfig<InputType, ValidationType, ResultType> = {
  validationEffect: Effect<InputType, ValidationType>;
  isValidationResultValid?: (validationResult: ValidationType) => boolean;
  resultEffect: Effect<InputType, ResultType>;
  initialResultGetter?: () => ResultType;
  withResultTrigger?: boolean;
  resultEffectInputEquals?: (a: InputType, b: InputType) => boolean;
};

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
  store.addLazyBehavior(
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

export const getValidatedInputWithResultSignalsFactory = <
  InputType,
  ValidationType,
  ResultType,
>(): ValidatedInputWithResultFactory<InputType, ValidationType, ResultType> =>
  getEffectSignalsFactory<InputType, ValidationType>()
    .bind(() => getEffectSignalsFactory<InputType, ResultType>())
    .mapConfig((config: ValidatedInputWithResultConfig<InputType, ValidationType, ResultType>) => ({
      c1: {
        effect: config.validationEffect,
      },
      c2: {
        effect: config.resultEffect,
        initialResultGetter: config.initialResultGetter,
        withTrigger: config.withResultTrigger,
        effectInputEquals: config.resultEffectInputEquals,
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
    .fmap((signals, config) => {
      const combined =
        getBehaviorId<ValidatedInputWithResult<InputType, ValidationType, ResultType>>();
      const setup = (store: Store) => {
        signals.setup(store);
        setupCombinedBehavior(
          store,
          signals.output,
          combined,
          config.isValidationResultValid ?? (validationResult => validationResult === null),
          config.initialResultGetter,
        );
      };
      return {
        setup,
        input: {
          input: signals.input.conflicts1.input,
          validationInvalidate: signals.input.conflicts1.invalidate,
          resultInvalidate: signals.input.conflicts2.invalidate,
          resultTrigger: signals.input.conflicts2.trigger,
        },
        output: {
          combined,
          validationErrors: signals.output.conflicts1.errors,
          validationSuccesses: signals.output.conflicts1.successes,
          resultErrors: signals.output.conflicts2.errors,
          resultSuccesses: signals.output.conflicts2.successes,
        },
      };
    });
