import { combineLatest, Observable } from 'rxjs';
import { distinctUntilChanged, filter, map, share, tap } from 'rxjs/operators';
import {
  CombinedEffectResult,
  EffectError,
  EffectSignalsType,
  getEffectSignalsFactory
} from './effect-signals-factory';
import { MappedSignalsType, Signals, SignalsFactory } from './signals-factory';
import { Store, TypeIdentifier } from './store';
import { EffectType, getIdentifier } from './store.utils';

export interface ValidatedInputWithResult<InputType, ValidationType, ResultType> {
  readonly currentInput: InputType;
  readonly validationPending: boolean;
  readonly validatedInput?: InputType;
  readonly validationResult?: ValidationType;
  readonly isValid: boolean;
  readonly resultPending: boolean;
  readonly resultInput?: InputType;
  readonly result?: ResultType;
}

export interface ValidatedInputWithResultSignalsType<InputType, ValidationType, ResultType> {
  readonly combinedBehavior: TypeIdentifier<
    ValidatedInputWithResult<InputType, ValidationType, ResultType>
  >;
  readonly validationErrorEvents: TypeIdentifier<EffectError<InputType>>;
  readonly validationInvalidateEvent: TypeIdentifier<void>;
  readonly resultErrorEvents: TypeIdentifier<EffectError<InputType>>;
  readonly resultInvalidateEvent: TypeIdentifier<void>;
}

export interface ValidatedInputWithTriggeredResultSignalsType<InputType, ValidationType, ResultType>
  extends ValidatedInputWithResultSignalsType<InputType, ValidationType, ResultType> {
  readonly resultTriggerEvent: TypeIdentifier<void>;
}

export interface ValidatedInputWithResultSignalsFactory<
  InputType,
  ValidationType,
  ResultType,
  SignalsType
> extends SignalsFactory<SignalsType> {
  withTrigger: () => ValidatedInputWithResultSignalsFactory<
    InputType,
    ValidationType,
    ResultType,
    ValidatedInputWithTriggeredResultSignalsType<InputType, ValidationType, ResultType>
  >;
}

interface FactoryConfiguration<InputType, ValidationType, ResultType> {
  inputGetter: (store: Store) => Observable<InputType>;
  validationEffect: EffectType<InputType, ValidationType>;
  isValidationResultValid: (validationResult: ValidationType) => boolean;
  resultEffect: EffectType<InputType, ResultType>;
  withResultTrigger?: boolean;
}

const resultInputGetter = <InputType, ValidationType>(
  store: Store,
  validationBehaviorId: TypeIdentifier<CombinedEffectResult<InputType, ValidationType>>,
  isValidationResultValid: (validationResult: ValidationType) => boolean,
) =>
  store.getBehavior(validationBehaviorId).pipe(
    tap(s => console.log('vali:', s)),
    filter(c => c.resultInput !== undefined && c.result !== undefined),
    filter(c => c.currentInput === c.resultInput),
    filter(c => isValidationResultValid(c.result as ValidationType)), // cast is OK, cause we checked for undefined in the first filter
    map(c => c.resultInput),
    distinctUntilChanged(),
    map(resultInput => resultInput as InputType), // cast is OK, cause we checked for undefined in the first filter
    share(),
    tap(s => console.log('result effect input:', s)),
  );

const mapBehaviors = <InputType, ValidationType, ResultType>(
  [v, r]: [
    CombinedEffectResult<InputType, ValidationType>,
    CombinedEffectResult<InputType, ResultType>,
  ],
  isValidationResultValid: (validationResult: ValidationType) => boolean,
) => ({
  currentInput: r.currentInput,
  validationPending: v.resultPending,
  validatedInput: v.resultInput,
  validationResult: v.result,
  isValid: v.result ? isValidationResultValid(v.result) : false,
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
) => {
  signals.setup(store);
  store.addLazyBehavior(
    id,
    combineLatest([
      store.getBehavior(signals.signals.signals1.combinedBehavior),
      store.getBehavior(signals.signals.signals2.combinedBehavior),
    ]).pipe(
      filter(([v, r]) => v.currentInput === r.currentInput),
      map(pair => mapBehaviors(pair, isValidationResultValid)),
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
      ).withTrigger(),
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
          validationInvalidateEvent: signals.signals.signals1.invalidateEvent,
          resultErrorEvents: signals.signals.signals2.errorEvents,
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
      ),
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
          validationInvalidateEvent: signals.signals.signals1.invalidateEvent,
          resultErrorEvents: signals.signals.signals2.errorEvents,
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
  });
