import { combineLatest, Observable, of, throwError } from 'rxjs';
import { catchError, debounceTime, filter, map, mapTo, switchMap, take } from 'rxjs/operators';
import { createSignalsFactory, Signals, SignalsFactory } from './signals-factory';
import { Store } from './store';
import { BehaviorId, EventId, getBehaviorId, getEventId, NO_VALUE } from './store-utils';

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
 * @property {InputType | undefined} previousInput - the input of the previous result, or undefined
 * @property {ResultType | undefined} previousResult - the previous result, or undefined
 */
export type EffectSuccess<InputType, ResultType> = Readonly<{
  result: ResultType;
  resultInput: InputType;
  previousInput?: InputType;
  previousResult?: ResultType;
}>;

/**
 * Type specifying the input signals of an EffectSignalsFactory (the corresponding signal sources are
 * not added to the store by the factory, but must be added e.g. by extendSetup or fmap).
 *
 * @typedef {object} EffectInputSignals<InputType> - object holding the input signal identifiers
 * @template InputType - specifies the input type for the effect
 * @property {BehaviorId<InputType>} input - identifier for the behavior being consumed by the resulting Signals type
 * @property {EventId<void>} invalidate - identifier for the invalidation event that can be dispatched to trigger re-evaluation of the current input under the given effect
 */
export type EffectInputSignals<InputType> = Readonly<{
  input: BehaviorId<InputType>;
  invalidate: EventId<void>;
  trigger: EventId<void>;
}>;

/**
 * Type specifying the output signals of an EffectSignalsFactory (signals produced by the resulting Signals type).
 *
 * @typedef {object} EffectOutputSignals<InputType, ResultType> - object holding the output signal identifiers
 * @template InputType - specifies the input type for the effect
 * @template ResultType - specifies the result type of the effect
 * @property {BehaviorId<CombinedEffectResult<InputType, ResultType>>} combined - identifier for the produced combined effect result behavior
 * @property {EventId<EffectError<InputType>>} errors - identifier for the produced error events
 * @property {EventId<EffectSuccess<InputType, ResultType>>} successes - identifier for the produced success events
 */
export type EffectOutputSignals<InputType, ResultType> = Readonly<{
  combined: BehaviorId<CombinedEffectResult<InputType, ResultType>>;
  errors: EventId<EffectError<InputType>>;
  successes: EventId<EffectSuccess<InputType, ResultType>>;
}>;

const getInputSignalIds = <InputType>(): EffectInputSignals<InputType> => ({
  input: getBehaviorId<InputType>(),
  invalidate: getEventId<void>(),
  trigger: getEventId<void>(),
});

const getOutputSignalIds = <InputType, ResultType>(): EffectOutputSignals<
  InputType,
  ResultType
> => ({
  combined: getBehaviorId<CombinedEffectResult<InputType, ResultType>>(),
  errors: getEventId<EffectError<InputType>>(),
  successes: getEventId<EffectSuccess<InputType, ResultType>>(),
});

/**
 * Type of the configuration object for EffectSignalsFactory
 *
 *    TODO
 */
export type EffectFactoryConfiguration<InputType, ResultType> = Readonly<{
  effect: EffectType<InputType, ResultType>;
  effectInputEquals?: (a: InputType, b: InputType) => boolean;
  withTrigger?: boolean;
  initialResultGetter?: () => ResultType;
  effectDebounceTime?: number;
}>;

const getEffectBuilder = <IT, RT>(
  config: EffectFactoryConfiguration<IT, RT>,
): Signals<EffectInputSignals<IT>, EffectOutputSignals<IT, RT>> => {
  const internalResultEffect = (
    input: IT,
    store: Store,
    previousInput?: IT,
    previousResult?: RT,
  ) => {
    try {
      return config.effect(input, store, previousInput, previousResult).pipe(take(1));
    } catch (error) {
      return throwError(() => error);
    }
  };

  const effectInputEquals = config.effectInputEquals ?? ((a, b) => a === b);

  const inIds = getInputSignalIds<IT>();
  const outIds = getOutputSignalIds<IT, RT>();
  const setup = (store: Store) => {
    const invalidateTokenBehavior = getBehaviorId<object | null>();
    store.addNonLazyBehavior(
      invalidateTokenBehavior,
      store.getEventStream(inIds.invalidate).pipe(
        map(() => ({})), // does not work with mapTo, because mapTo would always assign the same object
      ),
      null,
    );

    const resultEvent = getEventId<{
      readonly result?: RT;
      readonly resultInput: IT;
      readonly resultToken: object | null;
    }>();
    const resultBehavior = getBehaviorId<{
      readonly result?: RT;
      readonly resultInput?: IT;
      readonly resultToken: object | null;
    }>();
    const initialResult = config.initialResultGetter ? config.initialResultGetter() : undefined;
    store.addLazyBehavior(resultBehavior, store.getEventStream(resultEvent), {
      result: initialResult,
      resultToken: null,
    });

    const triggeredInputEvent = getEventId<IT>();
    const triggeredInputBehavior = getBehaviorId<IT | null>();
    store.addLazyBehavior(triggeredInputBehavior, store.getEventStream(triggeredInputEvent), null);

    // It is important to setup the combined observable as behavior,
    // because a simple shareReplay (even with refCount) would create a memory leak!!!
    const combinedId = getBehaviorId<
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
        store.getBehavior(inIds.input),
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
      outIds.errors,
      outIds.successes,
      eventSourceInput.pipe(
        filter(
          ([input, resultState, token]) =>
            token !== resultState.resultToken ||
            resultState.resultInput === undefined ||
            !effectInputEquals(input, resultState.resultInput),
        ),
        switchMap(([input, resultState, token, triggeredInput]) =>
          config.withTrigger && input !== triggeredInput
            ? store.getEventStream(inIds.trigger).pipe(
                mapTo({
                  type: triggeredInputEvent,
                  event: input,
                }),
              )
            : internalResultEffect(input, store, resultState.resultInput, resultState.result).pipe(
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
                      type: outIds.successes,
                      event: {
                        result,
                        resultInput: input,
                        previousInput: resultState.resultInput,
                        previousResult: resultState.result,
                      },
                    },
                  ),
                ),
                catchError(error =>
                  of(
                    {
                      type: outIds.errors,
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
      outIds.combined,
      combined.pipe(
        map(([input, resultState, token, triggeredInput]) => ({
          currentInput: input,
          result: resultState.result,
          resultInput: resultState.resultInput,
          resultPending: config.withTrigger
            ? input === triggeredInput &&
              (token !== resultState.resultToken ||
                resultState.resultInput === undefined ||
                !effectInputEquals(input, resultState.resultInput))
            : token !== resultState.resultToken ||
              resultState.resultInput === undefined ||
              !effectInputEquals(input, resultState.resultInput),
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
  return {
    setup,
    input: inIds,
    output: outIds,
  };
};

/**
 * This type specifies effect signal factories (extending signal factories). An effect signals factory is a signals factory
 * to generically handle sideeffects (hence, an abstraction over side-effects). Furthermore, they are implemeted as builders to
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
export type EffectSignalsFactory<InputType, ResultType> = SignalsFactory<
  EffectInputSignals<InputType>,
  EffectOutputSignals<InputType, ResultType>,
  EffectFactoryConfiguration<InputType, ResultType>
>;
/**
 * This function creates a configurable EffectSignalsFactory<InputType, ResultType, SignalsType>.
 * You must add a source for the consumed input event signal, using e.g. extendSetup or fmap
 *
 * @template InputType - specifies the input type for the effect
 * @template ResultType - specifies the result type of the effect
 * @param {function} effect - a function implementing EffectType<InputType, ResultType>
 * @returns {EffectSignalsFactory<InputType, ResultType, EffectInputSignals<InputType>>}
 */
export const getEffectSignalsFactory = <InputType, ResultType>(): EffectSignalsFactory<
  InputType,
  ResultType
> => createSignalsFactory(getEffectBuilder);
