import { combineLatest, Observable, of, throwError } from 'rxjs';
import { catchError, debounceTime, filter, map, mapTo, switchMap } from 'rxjs/operators';
import { createSignalsFactory, Signals, SignalsFactory } from './signals-factory';
import { Store } from './store';
import { getIdentifier, NO_VALUE, TypeIdentifier } from './store.utils';

/**
 * This type specifies the effect function that must be supplied to create an EffectSignalsFactory
 *
 * @typedef {function} EffectType<InputModel, ResultModel> - function performing an effect and returning an observable with the result
 * @template InputType - specifies the input type for the effect
 * @template ResultType - specifies the result type for the effect
 * @property {InputType} input - the effect input
 * @property {Store} store - the Store instance that will be passed to the function
 * @property {InputType | undefined} previousInput - the input of the previous function invocation, or undefined
 * @property {ResultType | undefined} previousResult - the result of the previous function invocation, or undefined
 */
export type EffectType<InputType, ResultType> = (
  input: InputType,
  store: Store,
  previousInput?: InputType,
  previousResult?: ResultType,
) => Observable<ResultType>;

/**
 * This specifies the type for the lazy behavior produced by an EffectSignalsFactory.
 *
 * @typedef {object} CombinedEffectResult<InputType, ResultType> - type for the behavior produced by effect signal factories
 * @template InputType - specifies the input type for the effect
 * @template ResultType - specifies the result type of the effect
 * @property {InputType | undefined} currentInput - current input (which might differ from the resultInput)
 * @property {InputType | undefined} resultInput - the input that produced the current result (or undefined, if result is undefined)
 * @property {ResultType | undefined} result - the current result (or undefined, if no result was received yet)
 * @property {boolean} resultPending - indicates whether the effect is currently running. (In case of a factory without trigger, this will be true whenever currentInput !== resultInput, or whenever an invalidation event has been sent)
 */
export type CombinedEffectResult<InputType, ResultType> = Readonly<{
  currentInput?: InputType;
  result?: ResultType;
  resultInput?: InputType;
  resultPending: boolean;
}>;

/**
 * Type for error events produced by an EffectSignalsFactory (unhandled effect errors).
 *
 * @typedef {object} EffectError<InputType> - type for error events produced by effect signal factories
 * @template InputType - specifies the input type for the effect
 * @property {any} error - the unhandled error thrown by an effect
 * @property {InputType} errorInput - the effect input that lead to the error
 */
export type EffectError<InputType> = Readonly<{
  error: any;
  errorInput: InputType;
}>;

/**
 * Type for success events produced by an EffectSignalsFactory.
 *
 * @typedef {object} EffectSuccess<InputType, ResultType> - type for success events produced by effect signal factories
 * @template InputType - specifies the input type for the effect
 * @template ResultType - specifies the result type of the effect
 * @property {ResultType} result - the effect result
 * @property {InputType} resultInput - the effect input that lead to the result
 */
export type EffectSuccess<InputType, ResultType> = Readonly<{
  result: ResultType;
  resultInput: InputType;
}>;

/**
 * Type specifying the signals of an EffectSignalsFactory.
 *
 * @typedef {object} EffectSignalsType<InputType, ResultType> - object holding the signal identifiers of effect signal factories
 * @template InputType - specifies the input type for the effect
 * @template ResultType - specifies the result type of the effect
 * @property {TypeIdentifier<CombinedEffectResult<InputType, ResultType>>} combinedBehavior - identifier for the produced combined effect result behavior
 * @property {TypeIdentifier<EffectError<InputType>>} errorEvents - identifier for the produced error events
 * @property {TypeIdentifier<EffectSuccess<InputType, ResultType>>} successEvents - identifier for the produced success events
 * @property {TypeIdentifier<void>} invalidateEvent - identifier for the invalidation event that can be dispatched to trigger re-evaluation of the current input under the given effect
 */
export type EffectSignalsType<InputType, ResultType> = Readonly<{
  combinedBehavior: TypeIdentifier<CombinedEffectResult<InputType, ResultType>>;
  errorEvents: TypeIdentifier<EffectError<InputType>>;
  successEvents: TypeIdentifier<EffectSuccess<InputType, ResultType>>;
  invalidateEvent: TypeIdentifier<void>;
}>;

/**
 * This type extends the EffectSignalsType type for manually triggered effects.
 *
 * @typedef {object} TriggeredEffectSignalsType<InputType, ResultType> - object holding the signal identifiers of effect signal factories with effect trigger event
 * @template InputType - specifies the input type for the effect
 * @template ResultType - specifies the result type of the effect
 * @property {TypeIdentifier<void>} triggerEvent - identifier for the trigger event that can be dispatched to trigger the effect
 */
export type TriggeredEffectSignalsType<InputType, ResultType> = EffectSignalsType<
  InputType,
  ResultType
> & {
  readonly triggerEvent: TypeIdentifier<void>;
};

const getSignalIds = <InputType, ResultType>(): TriggeredEffectSignalsType<
  InputType,
  ResultType
> => ({
  combinedBehavior: getIdentifier<CombinedEffectResult<InputType, ResultType>>(),
  errorEvents: getIdentifier<EffectError<InputType>>(),
  successEvents: getIdentifier<EffectSuccess<InputType, ResultType>>(),
  invalidateEvent: getIdentifier<void>(),
  triggerEvent: getIdentifier<void>(),
});

type EffectFactoryConfiguration<InputType, ResultType> = Readonly<{
  inputGetter: (store: Store) => Observable<InputType>;
  effect: EffectType<InputType, ResultType>;
  effectInputEquals: (a: InputType, b: InputType) => boolean;
  withTrigger?: boolean;
  initialResultGetter?: () => ResultType;
  effectDebounceTime?: number;
}>;

type FactoryBuild<SignalsType, ConfigurationType> = (
  configuration: ConfigurationType,
) => Signals<SignalsType>;

const getEffectBuilder = <IT, RT, SignalsType>(): FactoryBuild<
  SignalsType,
  EffectFactoryConfiguration<IT, RT>
> => {
  const build: FactoryBuild<SignalsType, EffectFactoryConfiguration<IT, RT>> = (
    config: EffectFactoryConfiguration<IT, RT>,
  ) => {
    const internalResultEffect = (
      input: IT,
      store: Store,
      previousInput?: IT,
      previousResult?: RT,
    ) => {
      try {
        return config.effect(input, store, previousInput, previousResult);
      } catch (error) {
        return throwError(error);
      }
    };

    const ids = getSignalIds<IT, RT>();
    const setup = (store: Store) => {
      const invalidateTokenBehavior = getIdentifier<object | null>();
      store.addNonLazyBehavior(
        invalidateTokenBehavior,
        store.getEventStream(ids.invalidateEvent).pipe(
          map(() => ({})), // does not work with mapTo, because mapTo would always assign the same object
        ),
        null,
      );

      const resultEvent = getIdentifier<{
        readonly result?: RT;
        readonly resultInput: IT;
        readonly resultToken: object | null;
      }>();
      const resultBehavior = getIdentifier<{
        readonly result?: RT;
        readonly resultInput?: IT;
        readonly resultToken: object | null;
      }>();
      const initialResult = config.initialResultGetter ? config.initialResultGetter() : undefined;
      store.addLazyBehavior(resultBehavior, store.getEventStream(resultEvent), {
        result: initialResult,
        resultToken: null,
      });

      const triggeredInputEvent = getIdentifier<IT>();
      const triggeredInputBehavior = getIdentifier<IT | null>();
      store.addLazyBehavior(
        triggeredInputBehavior,
        store.getEventStream(triggeredInputEvent),
        null,
      );

      // It is important to setup the combined observable as behavior,
      // because a simple shareReplay (event with refCount) would create a memory leak!!!
      const combinedId = getIdentifier<
        [
          IT,
          {
            readonly result?: RT;
            readonly resultInput?: IT;
            readonly resultToken: object | null;
          },
          object | null,
          IT,
        ]
      >();
      store.addLazyBehavior(
        combinedId,
        combineLatest([
          config.inputGetter(store),
          store.getBehavior(resultBehavior),
          store.getBehavior(invalidateTokenBehavior),
          store.getBehavior(triggeredInputBehavior),
        ]),
      );
      const combined = store.getBehavior(combinedId);

      const eventSourceInput =
        config.effectDebounceTime === undefined || config.effectDebounceTime < 1
          ? combined
          : combined.pipe(debounceTime(config.effectDebounceTime));

      store.add4TypedEventSource(
        Symbol(''),
        resultEvent,
        triggeredInputEvent,
        ids.errorEvents,
        ids.successEvents,
        eventSourceInput.pipe(
          filter(
            ([input, resultState, token]) =>
              token !== resultState.resultToken ||
              resultState.resultInput === undefined ||
              !config.effectInputEquals(input, resultState.resultInput),
          ),
          switchMap(([input, resultState, token, triggeredInput]) =>
            config.withTrigger && input !== triggeredInput
              ? store.getEventStream(ids.triggerEvent).pipe(
                  mapTo({
                    type: triggeredInputEvent,
                    event: input,
                  }),
                )
              : internalResultEffect(
                  input,
                  store,
                  resultState.resultInput,
                  resultState.result,
                ).pipe(
                  switchMap(result =>
                    of(
                      {
                        type: resultEvent,
                        event: {
                          result,
                          resultInput: input,
                          resultToken: token,
                        },
                      },
                      {
                        type: ids.successEvents,
                        event: {
                          result,
                          resultInput: input,
                        },
                      },
                    ),
                  ),
                  catchError(error =>
                    of(
                      {
                        type: ids.errorEvents,
                        event: {
                          error,
                          errorInput: input,
                        },
                      },
                      {
                        type: resultEvent,
                        event: {
                          resultInput: input,
                          resultToken: token,
                        },
                      },
                    ),
                  ),
                ),
          ),
        ),
        resultEvent,
      );

      store.addLazyBehavior(
        ids.combinedBehavior,
        combined.pipe(
          map(([input, resultState, token, triggeredInput]) => ({
            currentInput: input,
            result: resultState.result,
            resultInput: resultState.resultInput,
            resultPending: config.withTrigger
              ? input === triggeredInput &&
                (token !== resultState.resultToken ||
                  resultState.resultInput === undefined ||
                  !config.effectInputEquals(input, resultState.resultInput))
              : token !== resultState.resultToken ||
                resultState.resultInput === undefined ||
                !config.effectInputEquals(input, resultState.resultInput),
          })),
        ),
        config.initialResultGetter
          ? {
              result: config.initialResultGetter(),
              resultPending: false,
            }
          : NO_VALUE,
      );
    };
    const { triggerEvent, ...withoutTriggerID } = ids;
    return {
      setup,
      signals: (config.withTrigger ? ids : withoutTriggerID) as unknown as SignalsType,
    };
  };
  return build;
};

/**
 * This type specifies effect signal factories (extending signal factories). An effect signals factory is a signals factory
 * to generically handle sideeffects (hence, an abstraction over sideeffects). Furthermore, they are implemeted as builders to
 * allow for easy custom configuration.
 * An effect signals factory fulfills the following requirements:
 * 1.) The produced CombinedEffectResult<InputType, ResultType> behavior must be lazy, hence, as long as it is not subscribed,
 *     no effect will be triggered.
 * 2.) Unhandled effect errors are caught by the factory and dispatched as EffectError<InputType>. A subscription of the corresponding
 *     errors event stream will NOT subscribe the result behavior (see requirement 1).
 * 3.) In addition to the result behavior, also an event stream for EffectSuccess<InputType, ResultType> is provided. This is important
 *     in cases where an effect success should be used to trigger something else (e.g. close a popup), but you cannot use the result
 *     behavior, because it would mean to always subscribe the result (in contrast, subscription of the success event stream will NOT
 *     subscribe the result behavior).
 *
 * See the property descriptions for further configurable requirements.
 *
 * @typedef {object} EffectSignalsFactory<InputType, ResultType, SignalsType>
 * @template InputType - specifies the input type for the effect
 * @template ResultType - specifies the result type of the effect
 * @template SignalsType - specifies the concrete signals type (depends on configuration)
 * @property {function} withTrigger - returns a factory with TriggeredEffectSignalsType<InputType, ResultType>. In contrast to the factory without trigger, the resulting factory will pass input to the effect only if a corresponding trigger event is received (e.g. a save button has been clicked).
 * @property {function} withInitialResult - returns a factory that provides an initial result in the result behavior. For more flexibility, instead of the result itself, this function takes a function providing the initial result as argument.
 * @property {function} withEffectDebounce - returns a factory that uses the specified time to debounce the result effect. This is different from debouncing the input yourself! If you debounce the input yourself, then also the currentInput in the result behavior will be debounced (hence the whole result behavior will be debounced). In contrast, if you use this function, then only the result effect itself will be debounced.
 * @property {function} withCustomEffectInputEquals - by default, reference equals is used to make the effect input distinct. However, this function will return a factory that uses the provided custom equals function instead.
 */
export type EffectSignalsFactory<InputType, ResultType, SignalsType> =
  SignalsFactory<SignalsType> & {
    withTrigger: () => EffectSignalsFactory<
      InputType,
      ResultType,
      TriggeredEffectSignalsType<InputType, ResultType>
    >;
    withInitialResult: (
      resultGetter?: () => ResultType,
    ) => EffectSignalsFactory<InputType, ResultType, SignalsType>;
    withEffectDebounce: (
      debounceMS: number,
    ) => EffectSignalsFactory<InputType, ResultType, SignalsType>;
    withCustomEffectInputEquals: (
      effectInputEquals: (a: InputType, b: InputType) => boolean,
    ) => EffectSignalsFactory<InputType, ResultType, SignalsType>;
  };

const getEffectSignalsFactoryIntern = <
  InputType,
  ResultType,
  SignalsType extends EffectSignalsType<InputType, ResultType>,
>(
  config: EffectFactoryConfiguration<InputType, ResultType>,
): EffectSignalsFactory<InputType, ResultType, SignalsType> => {
  const builder = getEffectBuilder<InputType, ResultType, SignalsType>();
  const build = (): Signals<SignalsType> => builder(config);
  const withTrigger = () =>
    getEffectSignalsFactoryIntern<
      InputType,
      ResultType,
      TriggeredEffectSignalsType<InputType, ResultType>
    >({
      ...config,
      withTrigger: true,
    });
  const withInitialResult = (resultGetter?: () => ResultType) =>
    getEffectSignalsFactoryIntern<InputType, ResultType, SignalsType>({
      ...config,
      initialResultGetter: resultGetter,
    });
  const withEffectDebounce = (effectDebounceTime: number) =>
    getEffectSignalsFactoryIntern<InputType, ResultType, SignalsType>({
      ...config,
      effectDebounceTime,
    });
  const withCustomEffectInputEquals = (
    effectInputEquals: (a: InputType, b: InputType) => boolean,
  ) =>
    getEffectSignalsFactoryIntern<InputType, ResultType, SignalsType>({
      ...config,
      effectInputEquals,
    });
  return {
    ...createSignalsFactory(build),
    withTrigger,
    withInitialResult,
    withEffectDebounce,
    withCustomEffectInputEquals,
  };
};

/**
 * This function creates a configurable EffectSignalsFactory<InputType, ResultType, SignalsType>.
 *
 * @template InputType - specifies the input type for the effect
 * @template ResultType - specifies the result type of the effect
 * @param {function} inputGetter - a function providing an Observable<InputType>
 * @param {function} effect - a function implementing EffectType<InputType, ResultType>
 * @returns {EffectSignalsFactory<InputType, ResultType, EffectSignalsType<InputType, ResultType>>}
 */
export const getEffectSignalsFactory = <InputType, ResultType>(
  inputGetter: (store: Store) => Observable<InputType>,
  effect: EffectType<InputType, ResultType>,
): EffectSignalsFactory<InputType, ResultType, EffectSignalsType<InputType, ResultType>> => {
  const config: EffectFactoryConfiguration<InputType, ResultType> = {
    inputGetter,
    effect,
    effectInputEquals: (a, b) => a === b,
  };
  return getEffectSignalsFactoryIntern<
    InputType,
    ResultType,
    EffectSignalsType<InputType, ResultType>
  >(config);
};
