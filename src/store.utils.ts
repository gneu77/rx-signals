import { combineLatest, Observable } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, map, switchMap } from 'rxjs/operators';
import { NO_VALUE } from './source-observable';
import { Store, TypeIdentifier } from './store';

/**
 * A simple helper function to get a new TypeIdentifier for the RX-SIGNALS store.
 *
 * @template T - specifies the type for the corresponding store signal
 * @param {string} name - an optional name for the resulting TypeIdentifier symbol, defaulting to an empty string
 * @returns {TypeIdentifier<T>}
 */
export const getIdentifier = <T>(name: string = ''): TypeIdentifier<T> => ({
  symbol: Symbol(name),
});

/**
 * The factory function prepareEffectSignals takes this
 * as Partial<EffectSignalsFactoryOptions<InputModel, ResultModel>>).
 *
 * @typedef {object} EffectSignalsFactoryOptions<InputModel, ResultModel> - interface for supported options to the EffectSignalsFactory
 * @template InputModel - specifies the type of the effects input
 * @template ResultModel - specifies the type of the result behavior
 * @property {(prevInput: InputModel, nextInput: InputModel) => boolean} inputEquals - custom equals function for the effects input (defaults to a===b in the factory)
 * @property {ResultModel} initialResult - initial value for the result behavior
 * @property {string} identifierNamePrefix - a custom prefix for the generated TypeIdentifier symbols (defaults to empty string in the factory)
 * @property {number} inputDebounceTime - a custom debounce time for changed input before triggering the effect (defaults to 50ms in the factory)
 */
export interface EffectSignalsFactoryOptions<InputModel, ResultModel> {
  readonly inputEquals: (prevInput: InputModel, nextInput: InputModel) => boolean;
  readonly initialResult: ResultModel;
  readonly identifierNamePrefix: string;
  readonly inputDebounceTime: number;
}

/**
 * The type for the behavior that bundles the effect result with the corresponding input and loading info.
 *
 * @typedef {object} ResultWithInput<InputModel, ResultModel> - interface for result plus input plus loading info
 * @template InputModel - specifies the type of the effects input
 * @template ResultModel - specifies the type of the result behavior
 * @property {InputModel | symbol} input - the corresponding input to the result (or symbol NO_VALUE in case of an initial result without input)
 * @property {ResultModel} result - the corresponding result for the input (or the initial result, if specified)
 * @property {boolean} nextIsLoading - true, if a new result is pending (either due to changed input or due to invalidate event)
 */
export interface ResultWithInput<InputModel, ResultModel> {
  readonly input: InputModel | symbol;
  readonly result: ResultModel;
  readonly nextIsLoading: boolean;
}

/**
 * The factory prepareEffectSignals creates this type as result, holding generated identifiers and a callback to apply the setup to the store.
 *
 * @typedef {object} EffectSignalsFactoryResult<InputModel, ResultModel> - interface for the EffectSignalsFactory result
 * @template InputModel - specifies the type of the effects input
 * @template ResultModel - specifies the type of the result behavior
 * @property {object} identifiers - generated TypeIdentifiers for result behavior, is loading behavior and invalidate result event
 * @property {(store: Store) => void} setup - function that takes a store instance and applies the setup for the effect signals to it
 */
export interface EffectSignalsFactoryResult<InputModel, ResultModel> {
  readonly identifiers: {
    readonly resultBehaviorId: TypeIdentifier<ResultModel>;
    readonly resultWithInputBehaviorId: TypeIdentifier<ResultWithInput<InputModel, ResultModel>>;
    readonly isLoadingBehaviorId: TypeIdentifier<boolean>;
    readonly invalidateResultEventId: TypeIdentifier<void>;
  };
  readonly setup: (store: Store) => void;
}

/**
 * @typedef {function} EffectType<InputModel, ResultModel> - type for the effect parameter of the EffectSignalsFactory
 * @template InputModel - specifies the type of the effects input
 * @template ResultModel - specifies the type of the result behavior
 * @property {object} identifiers - generated TypeIdentifiers for result behavior, is loading behavior and invalidate result event
 * @property {(store: Store) => void} setup - function that takes a store instance and applies the setup for the effect signals to it
 */
export type EffectType<InputModel, ResultModel> = (
  input: InputModel,
  store: Store,
) => Observable<ResultModel>;

interface InternalResult<InputModel, ResultModel> {
  readonly input: InputModel | symbol;
  readonly result: ResultModel | symbol;
  readonly resultToken: object | null;
}

/**
 * This function is the EffectSignalsFactory. It serves as helper function to reduce boilerplate code when
 * working with a standard 'input-behavior -> effect -> result-behavior + isLoading-behavior' pattern,
 * including result invalidation via event. The pattern in more detail is as follows:
 *
 * Assume you have an application with a searchbar that should fetch corresponding results from any endpoint. The
 * concrete prerequisites and requirements are as follows:
 * - You have a behavior for model holding the query (part of a similar pattern 'input-event -> model-behavior -> validation-effect -> validated-model-behavior')
 * - Queries must be debounced (if the user is typing fast, no effect should be triggered until he pauses for a short time)
 * - Do not trigger the effect, if the input has not changed
 * - If the effect is triggered while a previous effect is still in progress, cancel the previous one (ensure always the latest result)
 * - Provide a loading behavior (ensure that it is always true while fetching data and always false while not)
 * - Provide a result behavior, as well as a result behavior that bundles the result with the input that lead to the result and the information, if another result is already pending.
 * - Provide an event to invalidate the result (refresh feature)
 *
 * @template InputModel - specifies the type of the effects input
 * @template ResultModel - specifies the type of the result behavior
 * @param {Observable<InputModel>} inputObservable -
 * @param {EffectType<InputModel, ResultModel>} effect - the effect taking InputModel and store instance to return a ResultModel observable
 * @param {Partial<EffectSignalsFactoryOptions<InputModel, ResultModel>>} options - see EffectSignalsFactoryOptions<InputModel, ResultModel> options interface for the defaults
 * @returns {EffectSignalsFactoryResult<InputModel, ResultModel>}
 */
export const prepareEffectSignals = <InputModel, ResultModel>(
  inputObservable: Observable<InputModel>,
  effect: EffectType<InputModel, ResultModel>,
  options: Partial<EffectSignalsFactoryOptions<InputModel, ResultModel>> = {},
): EffectSignalsFactoryResult<InputModel, ResultModel> => {
  const inputEquals: (prevInput: InputModel, nextInput: InputModel) => boolean =
    options.inputEquals ?? ((prev, next) => prev === next);
  const internalEquals = (
    input: InputModel,
    resultToken: object | null,
    state: InternalResult<InputModel, ResultModel>,
  ) =>
    resultToken === state.resultToken &&
    (state.input === input ||
      (state.input !== NO_VALUE && inputEquals(state.input as InputModel, input)));
  const initialResult = options.initialResult ?? NO_VALUE;
  const identifierNamePrefix = options.identifierNamePrefix ?? '';
  const inputDebounceTime = options.inputDebounceTime ?? 50;

  const resultBehaviorId = getIdentifier<ResultModel>(`${identifierNamePrefix}_Result`);
  const resultWithInputBehaviorId = getIdentifier<ResultWithInput<InputModel, ResultModel>>(
    `${identifierNamePrefix}_ResultWithInput`,
  );
  const isLoadingBehaviorId = getIdentifier<boolean>(`${identifierNamePrefix}_IsLoading`);
  const invalidateResultEventId = getIdentifier<void>(`${identifierNamePrefix}_InvalidateEvent`);
  const internalResultBehaviorId = getIdentifier<InternalResult<InputModel, ResultModel>>(
    `${identifierNamePrefix}_InternalResult`,
  );
  const resultTokenBehaviorId = getIdentifier<object | null>(`${identifierNamePrefix}_ResultToken`);
  const initialInternalResult: InternalResult<InputModel, ResultModel> = {
    input: NO_VALUE,
    result: initialResult,
    resultToken: null,
  };
  return {
    identifiers: {
      resultBehaviorId,
      resultWithInputBehaviorId,
      isLoadingBehaviorId,
      invalidateResultEventId,
    },
    setup: (store: Store) => {
      store.addNonLazyBehavior(
        resultTokenBehaviorId,
        store.getEventStream(invalidateResultEventId).pipe(
          map(() => ({})), // cannot use mapTo, because RxJs would optimize this to always return the same object
        ),
        null,
      );

      const combinedInput = combineLatest([
        inputObservable.pipe(distinctUntilChanged()),
        store.getBehavior(resultTokenBehaviorId),
        store.getBehavior(internalResultBehaviorId),
      ]);

      store.addLazyBehavior(
        internalResultBehaviorId,
        combinedInput.pipe(
          filter(([input, resultToken, state]) => !internalEquals(input, resultToken, state)),
          debounceTime(inputDebounceTime),
          switchMap(([input, resultToken]) =>
            effect(input, store).pipe(
              map(result => ({
                input,
                result,
                resultToken,
              })),
            ),
          ),
        ),
        initialInternalResult,
      );

      store.addLazyBehavior(
        isLoadingBehaviorId,
        combinedInput.pipe(
          map(([input, resultToken, state]) => !internalEquals(input, resultToken, state)),
        ),
        initialResult === NO_VALUE,
      );

      store.addLazyBehavior(
        resultWithInputBehaviorId,
        combinedInput.pipe(
          filter(tuple => tuple[2].result !== NO_VALUE),
          map(([input, resultToken, state]) => ({
            input,
            result: state.result as ResultModel,
            nextIsLoading: !internalEquals(input, resultToken, state),
          })),
        ),
        initialResult === NO_VALUE
          ? NO_VALUE
          : {
              input: NO_VALUE,
              result: initialResult as ResultModel,
              nextIsLoading: false,
            },
      );

      store.addLazyBehavior(
        resultBehaviorId,
        store.getBehavior(resultWithInputBehaviorId).pipe(map(result => result.result)),
        initialResult,
      );
    },
  };
};
