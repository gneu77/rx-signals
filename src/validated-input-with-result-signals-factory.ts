import { combineLatest, Observable } from 'rxjs';
import { distinctUntilChanged, filter, map, startWith } from 'rxjs/operators';
import {
  CombinedEffectResult,
  EffectError,
  EffectSignalsType,
  EffectSuccess,
  EffectType,
  getEffectSignalsFactory,
} from './effect-signals-factory';
import { MappedSignalsType, Signals, SignalsFactory } from './signals-factory';
import { Store } from './store';
import { getIdentifier, TypeIdentifier } from './store.utils';

export type ValidatedInputWithResult<InputType, ValidationType, ResultType> = Readonly<{
  currentInput?: InputType;
  validationPending: boolean;
  validatedInput?: InputType;
  validationResult?: ValidationType;
  isValid: boolean;
  resultPending: boolean;
  resultInput?: InputType;
  result?: ResultType;
}>;

export type ValidatedInputWithResultSignalsType<InputType, ValidationType, ResultType> = Readonly<{
  combinedBehavior: TypeIdentifier<ValidatedInputWithResult<InputType, ValidationType, ResultType>>;
  validationErrorEvents: TypeIdentifier<EffectError<InputType>>;
  validationSuccessEvents: TypeIdentifier<EffectSuccess<InputType, ValidationType>>;
  validationInvalidateEvent: TypeIdentifier<void>;
  resultErrorEvents: TypeIdentifier<EffectError<InputType>>;
  resultSuccessEvents: TypeIdentifier<EffectSuccess<InputType, ResultType>>;
  resultInvalidateEvent: TypeIdentifier<void>;
}>;

export type ValidatedInputWithTriggeredResultSignalsType<
  InputType,
  ValidationType,
  ResultType
> = ValidatedInputWithResultSignalsType<InputType, ValidationType, ResultType> & {
  readonly resultTriggerEvent: TypeIdentifier<void>;
};

export type ValidatedInputWithResultSignalsFactory<
  InputType,
  ValidationType,
  ResultType,
  SignalsType
> = SignalsFactory<SignalsType> & {
  withTrigger: () => ValidatedInputWithResultSignalsFactory<
    InputType,
    ValidationType,
    ResultType,
    ValidatedInputWithTriggeredResultSignalsType<InputType, ValidationType, ResultType>
  >;
  withInitialResult: (
    resultGetter?: () => ResultType,
  ) => ValidatedInputWithResultSignalsFactory<InputType, ValidationType, ResultType, SignalsType>;
  withCustomResultEffectInputEquals: (
    resultEffectInputEquals: (a: InputType, b: InputType) => boolean,
  ) => ValidatedInputWithResultSignalsFactory<InputType, ValidationType, ResultType, SignalsType>;
};

type FactoryConfiguration<InputType, ValidationType, ResultType> = {
  inputGetter: (store: Store) => Observable<InputType>;
  validationEffect: EffectType<InputType, ValidationType>;
  isValidationResultValid: (validationResult: ValidationType) => boolean;
  resultEffect: EffectType<InputType, ResultType>;
  resultEffectInputEquals: (a: InputType, b: InputType) => boolean;
  withResultTrigger?: boolean;
  initialResultGetter?: () => ResultType;
};

const resultInputGetter = <InputType, ValidationType>(
  store: Store,
  validationBehaviorId: TypeIdentifier<CombinedEffectResult<InputType, ValidationType>>,
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
  signals: Signals<
    MappedSignalsType<
      EffectSignalsType<InputType, ValidationType>,
      EffectSignalsType<InputType, ResultType>
    >
  >,
  id: TypeIdentifier<ValidatedInputWithResult<InputType, ValidationType, ResultType>>,
  isValidationResultValid: (validationResult: ValidationType) => boolean,
  initialResultGetter?: () => ResultType,
) => {
  signals.setup(store);
  store.addLazyBehavior(
    id,
    combineLatest([
      store.getBehavior(signals.signals.signals1.combinedBehavior),
      store.getBehavior(signals.signals.signals2.combinedBehavior).pipe(
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

const getValidatedInputWithTriggeredResultSignalsFactoryIntern = <
  InputType,
  ValidationType,
  ResultType
>(
  config: FactoryConfiguration<InputType, ValidationType, ResultType>,
): ValidatedInputWithResultSignalsFactory<
  InputType,
  ValidationType,
  ResultType,
  ValidatedInputWithTriggeredResultSignalsType<InputType, ValidationType, ResultType>
> => {
  const validationFactory = getEffectSignalsFactory<InputType, ValidationType>(
    config.inputGetter,
    config.validationEffect,
  );
  const factory = validationFactory
    .bind(validationSignals =>
      getEffectSignalsFactory<InputType, ResultType>(
        (store: Store) =>
          resultInputGetter(
            store,
            validationSignals.signals.combinedBehavior,
            config.isValidationResultValid,
          ),
        config.resultEffect,
      )
        .withTrigger()
        .withInitialResult(config.initialResultGetter)
        .withCustomEffectInputEquals(config.resultEffectInputEquals),
    )
    .fmap(signals => {
      const combinedBehavior = getIdentifier<
        ValidatedInputWithResult<InputType, ValidationType, ResultType>
      >();
      const setup = (store: Store) =>
        setupCombinedBehavior(store, signals, combinedBehavior, config.isValidationResultValid);
      return {
        setup,
        signals: {
          combinedBehavior,
          validationErrorEvents: signals.signals.signals1.errorEvents,
          validationSuccessEvents: signals.signals.signals1.successEvents,
          validationInvalidateEvent: signals.signals.signals1.invalidateEvent,
          resultErrorEvents: signals.signals.signals2.errorEvents,
          resultSuccessEvents: signals.signals.signals2.successEvents,
          resultInvalidateEvent: signals.signals.signals2.invalidateEvent,
          resultTriggerEvent: signals.signals.signals2.triggerEvent,
        },
      };
    });
  return {
    ...factory,
    withTrigger: () =>
      getValidatedInputWithTriggeredResultSignalsFactoryIntern({
        ...config,
        withResultTrigger: true,
      }),
    withInitialResult: (initialResultGetter?: () => ResultType) =>
      getValidatedInputWithTriggeredResultSignalsFactoryIntern({
        ...config,
        initialResultGetter,
      }),
    withCustomResultEffectInputEquals: (
      resultEffectInputEquals: (a: InputType, b: InputType) => boolean,
    ) =>
      getValidatedInputWithTriggeredResultSignalsFactoryIntern({
        ...config,
        resultEffectInputEquals,
      }),
  };
};

const getValidatedInputWithResultSignalsFactoryIntern = <InputType, ValidationType, ResultType>(
  config: FactoryConfiguration<InputType, ValidationType, ResultType>,
): ValidatedInputWithResultSignalsFactory<
  InputType,
  ValidationType,
  ResultType,
  ValidatedInputWithResultSignalsType<InputType, ValidationType, ResultType>
> => {
  const validationFactory = getEffectSignalsFactory<InputType, ValidationType>(
    config.inputGetter,
    config.validationEffect,
  );
  const factory = validationFactory
    .bind(validationSignals =>
      getEffectSignalsFactory<InputType, ResultType>(
        (store: Store) =>
          resultInputGetter(
            store,
            validationSignals.signals.combinedBehavior,
            config.isValidationResultValid,
          ),
        config.resultEffect,
      )
        .withInitialResult(config.initialResultGetter)
        .withCustomEffectInputEquals(config.resultEffectInputEquals),
    )
    .fmap(signals => {
      const combinedBehavior = getIdentifier<
        ValidatedInputWithResult<InputType, ValidationType, ResultType>
      >();
      const setup = (store: Store) =>
        setupCombinedBehavior(store, signals, combinedBehavior, config.isValidationResultValid);
      return {
        setup,
        signals: {
          combinedBehavior,
          validationErrorEvents: signals.signals.signals1.errorEvents,
          validationSuccessEvents: signals.signals.signals1.successEvents,
          validationInvalidateEvent: signals.signals.signals1.invalidateEvent,
          resultErrorEvents: signals.signals.signals2.errorEvents,
          resultSuccessEvents: signals.signals.signals2.successEvents,
          resultInvalidateEvent: signals.signals.signals2.invalidateEvent,
        },
      };
    });
  return {
    ...factory,
    withTrigger: () =>
      getValidatedInputWithTriggeredResultSignalsFactoryIntern({
        ...config,
        withResultTrigger: true,
      }),
    withInitialResult: (initialResultGetter?: () => ResultType) =>
      getValidatedInputWithResultSignalsFactoryIntern({
        ...config,
        initialResultGetter,
      }),
    withCustomResultEffectInputEquals: (
      resultEffectInputEquals: (a: InputType, b: InputType) => boolean,
    ) =>
      getValidatedInputWithResultSignalsFactoryIntern({
        ...config,
        resultEffectInputEquals,
      }),
  };
};

export const getValidatedInputWithResultSignalsFactory = <InputType, ValidationType, ResultType>(
  inputGetter: (store: Store) => Observable<InputType>,
  validationEffect: EffectType<InputType, ValidationType>,
  isValidationResultValid: (validationResult: ValidationType) => boolean,
  resultEffect: EffectType<InputType, ResultType>,
) =>
  getValidatedInputWithResultSignalsFactoryIntern({
    inputGetter,
    validationEffect,
    isValidationResultValid,
    resultEffect,
    resultEffectInputEquals: (a, b) => a === b,
  });
