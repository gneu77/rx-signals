import { combineLatest, of, throwError } from 'rxjs';
import { catchError, debounceTime, filter, map, switchMap, take } from 'rxjs/operators';
import { Signals, SignalsFactory } from './signals-factory';
import { Effect, Store } from './store';
import {
  DerivedId,
  EffectId,
  EventId,
  getDerivedId,
  getEffectId,
  getEventId,
  getStateId,
  NO_VALUE,
} from './store-utils';

/**
 * This specifies the type for the lazy behavior produced by EffectSignals.
 *
 * @typedef {object} CombinedEffectResult<Input, Result> - type for the behavior produced by effect signal factories
 * @template Input - specifies the input type for the effect
 * @template Result - specifies the result type of the effect
 * @property {Input | undefined} currentInput - current input (which might differ from the resultInput)
 * @property {Input | undefined} resultInput - the input that produced the current result (or undefined, if result is undefined)
 * @property {Result | undefined} result - the current result (or undefined, if no result was received yet)
 * @property {boolean} resultPending - indicates whether the effect is currently running. (In case of a factory without trigger, this will be true whenever currentInput !== resultInput, or whenever an invalidation event has been sent)
 */
export type CombinedEffectResult<Input, Result> = {
  currentInput?: Input;
  result?: Result;
  resultInput?: Input;
  resultPending: boolean;
};

/**
 * Type for error events produced by an EffectSignals (unhandled effect errors).
 *
 * @typedef {object} EffectError<Input> - type for error events produced by EffectSignals
 * @template Input - specifies the input type for the effect
 * @property {any} error - the unhandled error thrown by an effect
 * @property {Input} errorInput - the effect input that lead to the error
 */
export type EffectError<Input> = {
  error: any;
  errorInput: Input;
};

/**
 * Type for success events produced by EffectSignals.
 *
 * @typedef {object} EffectSuccess<Input, Result> - type for success events produced by EffectSignals
 * @template Input - specifies the input type for the effect
 * @template Result - specifies the result type of the effect
 * @property {Result} result - the effect result
 * @property {Input} resultInput - the effect input that lead to the result
 * @property {Input | undefined} previousInput - the input of the previous result, or undefined
 * @property {Result | undefined} previousResult - the previous result, or undefined
 */
export type EffectSuccess<Input, Result> = {
  result: Result;
  resultInput: Input;
  previousInput?: Input;
  previousResult?: Result;
};

/**
 * Type specifying the input EffectSignals (the corresponding signal-sources are NOT added to the store
 * by the EffectSignals-setup, but by whoever uses the signals, e.g. by extendSetup or fmap or just using dispatch).
 * The EffectSignalsFactory gives you the guarantee, that invalidate-events are NOT missed, even while
 * the combined-behavior is not subscribed.
 *
 * @typedef {object} EffectInputSignals<Input> - object holding the input signal identifiers for EffectSignals
 * @template Input - specifies the input type for the effect
 * @property {DerivedId<Input>} input - identifier for the behavior being consumed by EffectSignals as input
 * @property {EventId<undefined>} invalidate - identifier for the invalidation event that can be dispatched to trigger re-evaluation of the current input under the given effect
 * @property {EventId<undefined>} trigger - identifier for the trigger event that can be dispatched to trigger the given effect. This event has only meaning, if withTrigger is configured (see EffectConfiguration)
 */
export type EffectInputSignals<Input> = {
  input: DerivedId<Input>;
  invalidate: EventId<undefined>;
  trigger: EventId<undefined>;
};

/**
 * Type specifying the output EffectSignals (signals produced EffectSignals).
 *
 * @typedef {object} EffectOutputSignals<Input, Result> - object holding the output signal identifiers
 * @template Input - specifies the input type for the effect
 * @template Result - specifies the result type of the effect
 * @property {DerivedId<CombinedEffectResult<Input, Result>>} combined - identifier for the produced combined effect result behavior
 * @property {EventId<EffectError<Input>>} errors - identifier for the produced error events
 * @property {EventId<EffectSuccess<Input, Result>>} successes - identifier for the produced success events
 */
export type EffectOutputSignals<Input, Result> = {
  combined: DerivedId<CombinedEffectResult<Input, Result>>;
  errors: EventId<EffectError<Input>>;
  successes: EventId<EffectSuccess<Input, Result>>;
};

/**
 * Type specifying the effects-type of EffectSignals (the corresponding effects are NOT added to the store
 * by the EffectSignals-setup, but by whoever uses the signals, e.g. by useExistingEffect or via extended configuration plus extendSetup).
 *
 * @typedef {object} EffectFactoryEffects<Input> - object holding the effect identifiers for EffectSignals
 * @template Input - specifies the input type for the effect
 * @template Result - specifies the result type of the effect
 * @property {EffectId<Input, Result>} id - the id for the specific Effect function to be used
 */
export type EffectFactoryEffects<Input, Result> = {
  id: EffectId<Input, Result>;
};

/**
 * This type specifies generic effect signals. EffectSignals generically handle side-effects (hence, are an abstraction over side-effects).
 * They fulfill the following requirements:
 * 1.) The produced CombinedEffectResult<Input, Result> behavior must be lazy, hence, as long as it is not subscribed,
 *     no effect will be triggered.
 * 2.) Unhandled effect errors are caught and dispatched as EffectError<Input>. A subscription of the corresponding
 *     errors event stream will NOT subscribe the result behavior (see requirement 1).
 * 3.) In addition to the result behavior, also an event stream for EffectSuccess<Input, Result> is provided. This is important
 *     in cases where an effect success should be used to trigger something else (e.g. close a popup), but you cannot use the result
 *     behavior, because it would mean to always subscribe the result. In contrast, subscription of the success event stream will NOT
 *     subscribe the result behavior.
 *
 * See the documentation for EffectConfiguration<Input, Result> for further configuration of EffectSignals<Input, Result>.
 *
 * @typedef {object} EffectSignals<Input, Result>
 * @template Input - specifies the input type for the effect
 * @template Result - specifies the result type of the effect
 */
export type EffectSignals<Input, Result> = Signals<
  EffectInputSignals<Input>,
  EffectOutputSignals<Input, Result>,
  EffectFactoryEffects<Input, Result>
>;

/**
 * This type specifies the type of the argument to EffectSignalsBuild, hence the configuration of EffectSignals.
 *
 * @typedef {object} EffectConfiguration<Input, Result>
 * @template Input - specifies the input type for the effect
 * @template Result - specifies the result type of the effect
 * @property {function | undefined} effectInputEquals - optional function used to determine whether a new input equals the previous one. Defaults to strict equals (a === b)
 * @property {boolean | undefined} withTrigger - optional bool that defaults to false. If true, the effect will only be performed in case a trigger event is received (else, whenever the input changes).
 * @property {function | undefined} initialResultGetter - optional function that defaults to undefined. If not undefined, it will be used to determine an initial result for the result behavior.
 * @property {number | undefined} effectDebounceTime - optional number that defaults to undefined. If a number > 0 is specified, then it will be used as milliseconds to debounce new input to the effect (please DON't debounce the input signal yourself, because that would debounce before trigger and/or input equals).
 * @property {function | undefined} wrapperEffectGetter - optional function to wrap the effect defined by effectId with a custom Effect
 * @property {boolean | undefined} eagerInputSubscription - optional bool to specify whether the input behavior should be subscribed eagerly (defaults to false)
 * @property {string | undefined} nameExtension - optional string to be used as argument to calls of getBehaviorId and getEventId
 */
export type EffectConfiguration<Input, Result> = {
  effectInputEquals?: (a: Input, b: Input) => boolean;
  withTrigger?: boolean;
  initialResultGetter?: () => Result;
  effectDebounceTime?: number;
  wrappedEffectGetter?: (effect: Effect<Input, Result>) => Effect<Input, Result>;
  eagerInputSubscription?: boolean;
  nameExtension?: string;
};

/**
 * Type specifying the SignalsBuild function for EffectSignals.
 *
 * @typedef {function} EffectSignalsBuild - function taking an EffectConfiguration and producing EffectSignals
 * @template Input - specifies the input type for the effect
 * @template Result - specifies the result type of the effect
 * @param {EffectConfiguration<Input, Result>} config - the configuration for the EffectSignals
 */
export type EffectSignalsBuild = <Input, Result>(
  config: EffectConfiguration<Input, Result>,
) => EffectSignals<Input, Result>;

const getInputSignalIds = <Input>(nameExtension?: string): EffectInputSignals<Input> => ({
  input: getDerivedId<Input>(`${nameExtension ?? ''}_input`),
  invalidate: getEventId<undefined>(`${nameExtension ?? ''}_invalidate`),
  trigger: getEventId<undefined>(`${nameExtension ?? ''}_trigger`),
});

const getOutputSignalIds = <Input, Result>(
  nameExtension?: string,
): EffectOutputSignals<Input, Result> => ({
  combined: getDerivedId<CombinedEffectResult<Input, Result>>(`${nameExtension ?? ''}_combined`),
  errors: getEventId<EffectError<Input>>(`${nameExtension ?? ''}_errors`),
  successes: getEventId<EffectSuccess<Input, Result>>(`${nameExtension ?? ''}_successes`),
});

const getEffectBuilder: EffectSignalsBuild = <IT, RT>(
  config: EffectConfiguration<IT, RT>,
): EffectSignals<IT, RT> => {
  const effectId = getEffectId<IT, RT>();
  const internalResultEffect = (input: IT, store: Store, previousInput?: IT, previousResult?: RT) =>
    store.getEffect(effectId).pipe(
      take(1),
      switchMap(effect => {
        try {
          const wrappedEffect = config.wrappedEffectGetter
            ? config.wrappedEffectGetter(effect)
            : effect;
          return wrappedEffect(input, store, previousInput, previousResult).pipe(take(1));
        } catch (error) {
          return throwError(() => error);
        }
      }),
    );

  const effectInputEquals = config.effectInputEquals ?? ((a, b) => a === b);

  const inIds = getInputSignalIds<IT>(config.nameExtension);
  const outIds = getOutputSignalIds<IT, RT>(config.nameExtension);
  const setup = (store: Store) => {
    const invalidateTokenBehavior = getStateId<object | null>();
    store.addState(invalidateTokenBehavior, null);
    store.addReducer(invalidateTokenBehavior, inIds.invalidate, () => ({}));

    const internalInput = config.eagerInputSubscription === true ? getStateId<IT>() : inIds.input;
    if (internalInput !== inIds.input) {
      store.connect(inIds.input, internalInput);
    }

    const resultEvent = getEventId<{
      result?: RT;
      resultInput: IT;
      resultToken: object | null;
    }>();
    const resultBehavior = getDerivedId<{
      result?: RT;
      resultInput?: IT;
      resultToken: object | null;
    }>();
    const initialResult = config.initialResultGetter ? config.initialResultGetter() : undefined;
    store.addDerivedState(resultBehavior, store.getEventStream(resultEvent), {
      result: initialResult,
      resultToken: null,
    });

    const triggeredInputEvent = getEventId<IT>();
    const triggeredInputBehavior = getDerivedId<IT | null>();
    store.addDerivedState(triggeredInputBehavior, store.getEventStream(triggeredInputEvent), null);

    // It is important to setup the combined observable as behavior,
    // because a simple shareReplay (even with refCount) would create a memory leak!!!
    const combinedId = getDerivedId<
      [
        IT,
        {
          result?: RT;
          resultInput?: IT;
          resultToken: object | null;
        },
        object | null,
        IT | null,
      ]
    >();
    store.addDerivedState(
      combinedId,
      combineLatest([
        store.getBehavior(internalInput),
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
                map(() => ({
                  type: triggeredInputEvent,
                  event: input,
                })),
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

    store.addDerivedState(
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
    effects: {
      id: effectId,
    },
  };
};

/**
 * This type specifies a SignalsFactory wrapping EffectSignals.
 *
 * @typedef {object} EffectSignalsFactory<Input, Result>
 * @template Input - specifies the input type for the effect
 * @template Result - specifies the result type of the effect
 */
export type EffectSignalsFactory<Input, Result> = SignalsFactory<
  EffectInputSignals<Input>,
  EffectOutputSignals<Input, Result>,
  EffectConfiguration<Input, Result>,
  EffectFactoryEffects<Input, Result>
>;

/**
 * This function creates an EffectSignalsFactory<Input, Result>.
 *
 * @template Input - specifies the input type for the effect
 * @template Result - specifies the result type of the effect
 * @returns {EffectSignalsFactory<Input, Result>}
 */
export const getEffectSignalsFactory = <Input, Result>(): EffectSignalsFactory<Input, Result> =>
  new SignalsFactory<
    EffectInputSignals<Input>,
    EffectOutputSignals<Input, Result>,
    EffectConfiguration<Input, Result>,
    EffectFactoryEffects<Input, Result>
  >(getEffectBuilder);
