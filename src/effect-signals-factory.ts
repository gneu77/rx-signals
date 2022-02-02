import { combineLatest, of, throwError } from 'rxjs';
import { catchError, debounceTime, filter, map, mapTo, switchMap, take } from 'rxjs/operators';
import { Signals, SignalsFactory } from './signals-factory';
import { Store } from './store';
import { BehaviorId, EffectId, EventId, getBehaviorId, getEventId, NO_VALUE } from './store-utils';

/**
 * This specifies the type for the lazy behavior produced by EffectSignals.
 *
 * @typedef {object} CombinedEffectResult<InputType, ResultType> - type for the behavior produced by effect signal factories
 * @template InputType - specifies the input type for the effect
 * @template ResultType - specifies the result type of the effect
 * @property {InputType | undefined} currentInput - current input (which might differ from the resultInput)
 * @property {InputType | undefined} resultInput - the input that produced the current result (or undefined, if result is undefined)
 * @property {ResultType | undefined} result - the current result (or undefined, if no result was received yet)
 * @property {boolean} resultPending - indicates whether the effect is currently running. (In case of a factory without trigger, this will be true whenever currentInput !== resultInput, or whenever an invalidation event has been sent)
 */
export type CombinedEffectResult<InputType, ResultType> = {
  currentInput?: InputType;
  result?: ResultType;
  resultInput?: InputType;
  resultPending: boolean;
};

/**
 * Type for error events produced by an EffectSignals (unhandled effect errors).
 *
 * @typedef {object} EffectError<InputType> - type for error events produced by EffectSignals
 * @template InputType - specifies the input type for the effect
 * @property {any} error - the unhandled error thrown by an effect
 * @property {InputType} errorInput - the effect input that lead to the error
 */
export type EffectError<InputType> = {
  error: any;
  errorInput: InputType;
};

/**
 * Type for success events produced by EffectSignals.
 *
 * @typedef {object} EffectSuccess<InputType, ResultType> - type for success events produced by EffectSignals
 * @template InputType - specifies the input type for the effect
 * @template ResultType - specifies the result type of the effect
 * @property {ResultType} result - the effect result
 * @property {InputType} resultInput - the effect input that lead to the result
 * @property {InputType | undefined} previousInput - the input of the previous result, or undefined
 * @property {ResultType | undefined} previousResult - the previous result, or undefined
 */
export type EffectSuccess<InputType, ResultType> = {
  result: ResultType;
  resultInput: InputType;
  previousInput?: InputType;
  previousResult?: ResultType;
};

/**
 * Type specifying the input EffectSignals (the corresponding signal-sources are NOT added to the store
 * by the EffectSignals-setup, but by whoever uses the signals, e.g. by extendSetup or fmap or just using dispatch).
 * The EffectSignalsFactory gives you the guarantee, that invalidate-events are NOT missed, even while
 * the combined-behavior is not subscribed.
 *
 * @typedef {object} EffectInputSignals<InputType> - object holding the input signal identifiers for EffectSignals
 * @template InputType - specifies the input type for the effect
 * @property {BehaviorId<InputType>} input - identifier for the behavior being consumed by EffectSignals as input
 * @property {EventId<void>} invalidate - identifier for the invalidation event that can be dispatched to trigger re-evaluation of the current input under the given effect
 * @property {EventId<void>} trigger - identifier for the trigger event that can be dispatched to trigger the given effect. This event has only meaning, if withTrigger is configured (see EffectConfiguration)
 */
export type EffectInputSignals<InputType> = {
  input: BehaviorId<InputType>;
  invalidate: EventId<void>;
  trigger: EventId<void>;
};

/**
 * Type specifying the output EffectSignals (signals produced EffectSignals).
 *
 * @typedef {object} EffectOutputSignals<InputType, ResultType> - object holding the output signal identifiers
 * @template InputType - specifies the input type for the effect
 * @template ResultType - specifies the result type of the effect
 * @property {BehaviorId<CombinedEffectResult<InputType, ResultType>>} combined - identifier for the produced combined effect result behavior
 * @property {EventId<EffectError<InputType>>} errors - identifier for the produced error events
 * @property {EventId<EffectSuccess<InputType, ResultType>>} successes - identifier for the produced success events
 */
export type EffectOutputSignals<InputType, ResultType> = {
  combined: BehaviorId<CombinedEffectResult<InputType, ResultType>>;
  errors: EventId<EffectError<InputType>>;
  successes: EventId<EffectSuccess<InputType, ResultType>>;
};

/**
 * This type specifies generic effect signals. EffectSignals generically handle side-effects (hence, are an abstraction over side-effects).
 * They fulfill the following requirements:
 * 1.) The produced CombinedEffectResult<InputType, ResultType> behavior must be lazy, hence, as long as it is not subscribed,
 *     no effect will be triggered.
 * 2.) Unhandled effect errors are caught and dispatched as EffectError<InputType>. A subscription of the corresponding
 *     errors event stream will NOT subscribe the result behavior (see requirement 1).
 * 3.) In addition to the result behavior, also an event stream for EffectSuccess<InputType, ResultType> is provided. This is important
 *     in cases where an effect success should be used to trigger something else (e.g. close a popup), but you cannot use the result
 *     behavior, because it would mean to always subscribe the result. In contrast, subscription of the success event stream will NOT
 *     subscribe the result behavior.
 *
 * See the documentation for EffectConfiguration<InputType, ResultType> for further configuration of EffectSignals<InputType, ResultType>.
 *
 * @typedef {object} EffectSignals<InputType, ResultType>
 * @template InputType - specifies the input type for the effect
 * @template ResultType - specifies the result type of the effect
 */
export type EffectSignals<InputType, ResultType> = Signals<
  EffectInputSignals<InputType>,
  EffectOutputSignals<InputType, ResultType>
>;

/**
 * This type specifies the type of the argument to EffectSignalsBuild, hence the configuration of EffectSignals.
 *
 * @typedef {object} EffectConfiguration<InputType, ResultType>
 * @template InputType - specifies the input type for the effect
 * @template ResultType - specifies the result type of the effect
 * @property {EffectId<InputType, ResultType>} effectId - the id for the specific Effect function to be used (mandatory).
 * @property {function | undefined} effectInputEquals - optional function used to determine whether a new input equals the previous one. Defaults to strict equals (a === b)
 * @property {boolean | undefined} withTrigger - optional bool that defaults to false. If true, the effect will only be performed in case a trigger event is received (else, whenever the input changes).
 * @property {function | undefined} initialResultGetter - optional function that defaults to undefined. If not undefined, it will be used to determine an initial result for the result behavior.
 * @property {number | undefined} effectDebounceTime - optional number that defaults to undefined. If a number > 0 is specified, then it will be used as milliseconds to debounce new input to the effect (please DON't debounce the input signal yourself, because that would debounce before trigger and/or input equals).
 */
export type EffectConfiguration<InputType, ResultType> = {
  effectId: EffectId<InputType, ResultType>;
  effectInputEquals?: (a: InputType, b: InputType) => boolean;
  withTrigger?: boolean;
  initialResultGetter?: () => ResultType;
  effectDebounceTime?: number;
};

/**
 * Type specifying the SignalsBuild function for EffectSignals.
 *
 * @typedef {function} EffectSignalsBuild - function taking an EffectConfiguration and producing EffectSignals
 * @template InputType - specifies the input type for the effect
 * @template ResultType - specifies the result type of the effect
 * @param {EffectConfiguration<InputType, ResultType>} config - the configuration for the EffectSignals
 */
export type EffectSignalsBuild = <InputType, ResultType>(
  config: EffectConfiguration<InputType, ResultType>,
) => EffectSignals<InputType, ResultType>;

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

const getEffectBuilder: EffectSignalsBuild = <IT, RT>(
  config: EffectConfiguration<IT, RT>,
): EffectSignals<IT, RT> => {
  const internalResultEffect = (input: IT, store: Store, previousInput?: IT, previousResult?: RT) =>
    store.getEffect(config.effectId).pipe(
      take(1),
      switchMap(effect => {
        try {
          return effect(input, store, previousInput, previousResult).pipe(take(1));
        } catch (error) {
          return throwError(() => error);
        }
      }),
    );

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
      result?: RT;
      resultInput: IT;
      resultToken: object | null;
    }>();
    const resultBehavior = getBehaviorId<{
      result?: RT;
      resultInput?: IT;
      resultToken: object | null;
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
          result?: RT;
          resultInput?: IT;
          resultToken: object | null;
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
 * This type specifies a SignalsFactory wrapping EffectSignals.
 *
 * @typedef {object} EffectSignalsFactory<InputType, ResultType>
 * @template InputType - specifies the input type for the effect
 * @template ResultType - specifies the result type of the effect
 */
export type EffectSignalsFactory<InputType, ResultType> = SignalsFactory<
  EffectInputSignals<InputType>,
  EffectOutputSignals<InputType, ResultType>,
  EffectConfiguration<InputType, ResultType>
>;

/**
 * This function creates an EffectSignalsFactory<InputType, ResultType>.
 *
 * @template InputType - specifies the input type for the effect
 * @template ResultType - specifies the result type of the effect
 * @returns {EffectSignalsFactory<InputType, ResultType>}
 */
export const getEffectSignalsFactory = <InputType, ResultType>(): EffectSignalsFactory<
  InputType,
  ResultType
> =>
  new SignalsFactory<
    EffectInputSignals<InputType>,
    EffectOutputSignals<InputType, ResultType>,
    EffectConfiguration<InputType, ResultType>
  >(getEffectBuilder);
