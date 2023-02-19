import {
  Observable,
  catchError,
  combineLatest,
  debounceTime,
  filter,
  map,
  of,
  switchMap,
  take,
  throwError,
} from 'rxjs';
import { Signals, SignalsFactory } from './signals-factory';
import { Effect, Store } from './store';
import {
  DerivedId,
  EffectId,
  EventId,
  NO_VALUE,
  NoValueType,
  getDerivedId,
  getEffectId,
  getEventId,
  getStateId,
  isNoValueType,
  isNotNoValueType,
} from './store-utils';

/**
 * Value-type for the combined derived behavior produced by {@link EffectSignals}.
 *
 * @template Input - specifies the input type for the effect
 * @template Result - specifies the result type of the effect
 */
export type CombinedEffectResult<Input, Result> = {
  /**
   * The current input (which might differ from the resultInput),
   * or `NO_VALUE`, if no input was received yet
   */
  currentInput: Input | NoValueType;

  /**
   * The current result,
   * or `NO_VALUE` if no result was received yet,
   * or the effect produced an error
   */
  result: Result | NoValueType;

  /**
   * The input that produced the current result,
   * or `NO_VALUE`, if initial result or no result received yet */
  resultInput: Input | NoValueType;

  /**
   * In case the effect led to an error (`result === NO_VALUE` in that case), else undefined */
  resultError?: any;

  /**
   * Indicates whether the effect is currently running.
   * In case of a factory without trigger, this will be true whenever one or multiple
   * of the following conditions is met:
   * `currentInput !== resultInput`,
   * or an invalidation event has been sent,
   * or the effect has sent a result, but has not yet completed.
   * In case of a factory with result-trigger, in addition to the previous
   * criteria, a trigegr event must have been received.
   */
  resultPending: boolean;
};

/**
 * Type representing a {@link CombinedEffectResult} in it's error state (non-pending)
 *
 * @template Input - specifies the input type for the effect
 */
export type CombinedEffectResultInErrorState<Input> = {
  currentInput: Input;
  result: NoValueType;
  resultInput: Input;
  resultError: any;
  resultPending: false;
};

/**
 * Typeguard to check if a {@link CombinedEffectResult} is a {@link CombinedEffectResultInErrorState}
 */
export const isCombinedEffectResultInErrorState = <Input, Result>(
  cer: CombinedEffectResult<Input, Result>,
): cer is CombinedEffectResultInErrorState<Input> =>
  !!cer.resultError &&
  !cer.resultPending &&
  isNoValueType(cer.result) &&
  isNotNoValueType(cer.resultInput);

/**
 * Type representing a {@link CombinedEffectResult} in it's success state (non-pending)
 *
 * @template Input - specifies the input type for the effect
 * @template Result - specifies the result type of the effect
 */
export type CombinedEffectResultInSuccessState<Input, Result> = {
  currentInput: Input | NoValueType;
  result: Result;
  resultInput: Input | NoValueType;
  resultPending: false;
};

/**
 * Typeguard to check if a {@link CombinedEffectResult} is a {@link CombinedEffectResultInSuccessState}
 */
export const isCombinedEffectResultInSuccessState = <Input, Result>(
  cer: CombinedEffectResult<Input, Result>,
): cer is CombinedEffectResultInSuccessState<Input, Result> =>
  !cer.resultError && !cer.resultPending && isNotNoValueType(cer.result);

/**
 * Value-type for error events produced by an {@link EffectSignals} (unhandled effect errors).
 *
 * @template Input - specifies the input type for the effect
 */
export type EffectError<Input> = {
  /** the unhandled error thrown by an effect */
  error: any;

  /** the effect input that lead to the error */
  errorInput: Input;
};

/**
 * Value-type for success events produced by {@link EffectSignals}.
 * In case the effect completes after one result, two success events will
 * be dispatched, one with completed false and one with completed true.
 * This is to handle cases where the effect might send multiple results
 * before completing. Thus, if an effect never completes, all success event
 * will have completed false.
 *
 * @template Input - specifies the input type for the effect
 * @template Result - specifies the result type of the effect
 */
export type EffectSuccess<Input, Result> = {
  /** the effect result */
  result: Result;

  /** the effect input that lead to the result */
  resultInput: Input;

  /** the input of the previous completed result, or `NO_VALUE` */
  previousInput: Input | NoValueType;

  /** the previous completed result, or `NO_VALUE` */
  previousResult: Result | NoValueType;

  /** has the effect for the given resultInput completed */
  completed: boolean;
};

/**
 * Value-type for completed success events produced by {@link EffectSignals}.
 * In contrast to {@link EffectSuccess} events with this type are only dispatched,
 * if the effect has completed, hence it will never be fired for effects that never complete.
 *
 * @template Input - specifies the input type for the effect
 * @template Result - specifies the result type of the effect
 */
export type EffectCompletedSuccess<Input, Result> = Omit<
  EffectSuccess<Input, Result>,
  'completed'
> & { completed: true };

const isCompletedSuccess = <Input, Result>(
  value: EffectCompletedSuccess<Input, Result> | EffectSuccess<Input, Result>,
): value is EffectCompletedSuccess<Input, Result> => value.completed;

/**
 * Type specifying the input {@link EffectSignals} (the corresponding signal-sources are NOT added to the store
 * by the EffectSignals-setup, but by whoever uses the signals, e.g. by extendSetup or fmap or just using dispatch).
 * The {@link EffectSignalsFactory} gives you the guarantee, that invalidate-events are NOT missed, even while
 * the combined-behavior is not subscribed.
 *
 * @template Input - specifies the input type for the effect
 */
export type EffectInputSignals<Input> = {
  /** Behavior being consumed by EffectSignals as input (see {@link EffectConfiguration} on how to configure your factory to subscribe the corresponding behavior eagerly) */
  input: DerivedId<Input>;

  /** Event that can be dispatched to trigger re-evaluation of the current input under the given effect */
  invalidate: EventId<undefined>;

  /**
   * Event that can be dispatched to trigger the given effect.
   * This event has only meaning, if `withTrigger` is configured (see `EffectConfiguration`),
   * else dispatching it is a no-op. */
  trigger: EventId<undefined>;
};

/**
 * Type specifying the output {@link EffectSignals} (signals produced by `EffectSignals`).
 * The {@link EffectSignalsFactory} takes care that subscribing error- or success-events keeps
 * the effect itself lazy (hence only subscribing the combined behavior will subscribe the effect itself).
 *
 * @template Input - specifies the input type for the effect
 * @template Result - specifies the result type of the effect
 */
export type EffectOutputSignals<Input, Result> = {
  /** Produced combined effect result behavior */
  combined: DerivedId<CombinedEffectResult<Input, Result>>;

  /** Convenience behavior derived from combined-behavior, representing only completed success states */
  result: DerivedId<CombinedEffectResultInSuccessState<Input, Result>>;

  /** Convenience behavior derived from combined-behavior, representing only pending state */
  pending: DerivedId<boolean>;

  /** Produced error events */
  errors: EventId<EffectError<Input>>;

  /** Produced success events */
  successes: EventId<EffectSuccess<Input, Result>>;

  /** Produced success events */
  completedSuccesses: EventId<EffectCompletedSuccess<Input, Result>>;
};

/**
 * Type specifying the effect-type of {@link EffectSignals} (the corresponding effects are NOT added to the store
 * by the EffectSignals-setup, but by whoever uses the signals, e.g. by `useExistingEffect` or via extended configuration plus `extendSetup`).
 *
 * @template Input - specifies the input type for the effect
 * @template Result - specifies the result type of the effect
 */
export type EffectFactoryEffects<Input, Result> = {
  id: EffectId<Input, Result>;
};

/**
 * This type specifies generic effect signals. `EffectSignals` generically handle side-effects (hence, are an abstraction over side-effects).
 * They fulfill the following requirements:
 * ```markdown
 * 1.) The produced CombinedEffectResult<Input, Result> behavior must be lazy, hence, as long as it is not subscribed,
 *     no effect will be triggered.
 * 2.) Unhandled effect errors are caught and dispatched as EffectError<Input>. A subscription of the corresponding
 *     errors event stream will NOT subscribe the result behavior (see requirement 1).
 * 3.) In addition to the result behavior, also an event-stream for EffectSuccess<Input, Result> is provided. This is important
 *     in cases where an effect success should be used to trigger something else (e.g. close a popup), but you cannot use the result
 *     behavior, because it would mean to always subscribe the result. In contrast, subscription of the success event stream will NOT
 *     subscribe the result behavior. (the same holds true for the completedSuccesses event-stream)
 * ```
 *
 * See the documentation for {@link EffectConfiguration} for further configuration of `EffectSignals`.
 *
 * @template Input - specifies the input type for the effect
 * @template Result - specifies the result type of the effect
 */
export type EffectSignals<Input, Result> = Signals<
  EffectInputSignals<Input>,
  EffectOutputSignals<Input, Result>,
  EffectFactoryEffects<Input, Result>
>;

/**
 * This type specifies the type of the argument to {@link EffectSignalsBuild}, hence the configuration of {@link EffectSignals}.
 *
 * @template Input - specifies the input type for the effect
 * @template Result - specifies the result type of the effect
 */
export type EffectConfiguration<Input, Result> = {
  /** Function used to determine whether a new input equals the previous one. Defaults to strict equals (`a === b`) */
  effectInputEquals?: (a: Input, b: Input) => boolean;

  /** Defaults to false. If true, the effect will only be performed in case a trigger event is received (else, whenever the input changes) */
  withTrigger?: boolean;

  /** If defined, this function will be used to determine an initial result for the result behavior */
  initialResultGetter?: () => Result;

  /** If defined and `>0`, then it will be used as milliseconds to debounce new input to the effect (please DON'T debounce the input signal yourself, because that would debounce before trigger and/or input equals!) */
  effectDebounceTime?: number;

  /** Function to wrap the effect defined by effectId with a custom `Effect` */
  wrappedEffectGetter?: (effect: Effect<Input, Result>) => Effect<Input, Result>;

  /** Specifies whether the input behavior should be subscribed eagerly (defaults to false) */
  eagerInputSubscription?: boolean;

  /** Optional string to be used as argument to calls of `getBehaviorId` and `getEventId` */
  nameExtension?: string;
};

/**
 * Type specifying the {@link SignalsBuild} function for {@link EffectSignals}, hence a function taking a {@link EffectConfiguration} and producing {@link EffectSignals}.
 *
 * @template Input - specifies the input type for the effect
 * @template Result - specifies the result type of the effect
 * @param {EffectConfiguration<Input, Result>} config - the configuration for the `EffectSignals`
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
  result: getDerivedId<CombinedEffectResultInSuccessState<Input, Result>>(
    `${nameExtension ?? ''}_result`,
  ),
  pending: getDerivedId<boolean>(`${nameExtension ?? ''}_pending`),
  errors: getEventId<EffectError<Input>>(`${nameExtension ?? ''}_errors`),
  successes: getEventId<EffectSuccess<Input, Result>>(`${nameExtension ?? ''}_successes`),
  completedSuccesses: getEventId<EffectCompletedSuccess<Input, Result>>(
    `${nameExtension ?? ''}_completedSuccesses`,
  ),
});

const NO_VALUE_TRIGGERED_INPUT = '$INTERNAL_NV_TI$';
type NoValueTriggeredInput = typeof NO_VALUE_TRIGGERED_INPUT;

type InternalEffectResult<RT> = {
  result: RT;
  completed: boolean;
};

type InternalResultType<Input, Result> = {
  result: Result | NoValueType;
  resultInput: Input | NoValueType;
  resultError?: any;
  resultToken: object | null;
};

const getIsNewInput =
  <Input, Result>(effectInputEquals: (a: Input, b: Input) => boolean) =>
  ([input, resultState, token]: [
    Input,
    InternalResultType<Input, InternalEffectResult<Result>>,
    object | null,
    Input | NoValueTriggeredInput,
  ]): boolean =>
    token !== resultState.resultToken ||
    isNoValueType(resultState.resultInput) ||
    !effectInputEquals(input, resultState.resultInput);

const getEffectBuilder: EffectSignalsBuild = <IT, RT>(
  config: EffectConfiguration<IT, RT>,
): EffectSignals<IT, RT> => {
  const effectId = getEffectId<IT, RT>();
  const wrappedResultEffect = (
    input: IT,
    store: Store,
    previousInput: IT | NoValueType,
    previousResult: RT | NoValueType,
  ) =>
    store.getEffect(effectId).pipe(
      take(1),
      switchMap(effect => {
        try {
          const wrappedEffect = config.wrappedEffectGetter
            ? config.wrappedEffectGetter(effect)
            : effect;
          return wrappedEffect(input, store, previousInput, previousResult);
        } catch (error) {
          return throwError(() => error);
        }
      }),
    );
  const internalResultEffect = (
    input: IT,
    store: Store,
    previousInput: IT | NoValueType,
    previousResult: RT | NoValueType,
  ): Observable<InternalEffectResult<RT>> =>
    new Observable<InternalEffectResult<RT>>(subscriber => {
      let currentResult: RT | NoValueType = NO_VALUE;
      const subscription = wrappedResultEffect(
        input,
        store,
        previousInput,
        previousResult,
      ).subscribe({
        next: result => {
          currentResult = result;
          subscriber.next({
            result,
            completed: false,
          });
        },
        complete: () => {
          if (isNotNoValueType(currentResult)) {
            subscriber.next({
              result: currentResult,
              completed: true,
            });
          }
          subscriber.complete();
          currentResult = NO_VALUE;
        },
        error: e => {
          subscriber.error(e);
          currentResult = NO_VALUE;
        },
      });
      return () => {
        subscription.unsubscribe();
        currentResult = NO_VALUE;
      };
    });

  const effectInputEquals = config.effectInputEquals ?? ((a, b) => a === b);
  const isNewInput = getIsNewInput<IT, RT>(effectInputEquals);

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

    const resultEvent = getEventId<InternalResultType<IT, InternalEffectResult<RT>>>();
    const resultBehavior = getDerivedId<InternalResultType<IT, InternalEffectResult<RT>>>();
    const initialResult = config.initialResultGetter ? config.initialResultGetter() : NO_VALUE;
    store.addDerivedState(resultBehavior, store.getEventStream(resultEvent), {
      result: isNotNoValueType(initialResult)
        ? { result: initialResult, completed: true }
        : NO_VALUE,
      resultInput: NO_VALUE,
      resultToken: null,
    });

    const triggeredInputEvent = getEventId<IT>();
    const triggeredInputBehavior = getDerivedId<IT | NoValueTriggeredInput>();
    store.addDerivedState(
      triggeredInputBehavior,
      store.getEventStream(triggeredInputEvent),
      NO_VALUE_TRIGGERED_INPUT,
    );

    store.addEventSource(
      outIds.completedSuccesses,
      store.getEventStream(outIds.successes).pipe(filter(isCompletedSuccess)),
    );

    // It is important to setup the combined observable as behavior,
    // because a simple shareReplay (even with refCount) could create a memory leak!!!
    const combinedId =
      getDerivedId<
        [
          IT,
          InternalResultType<IT, InternalEffectResult<RT>>,
          object | null,
          IT | NoValueTriggeredInput,
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
        filter(isNewInput),
        switchMap(
          ([input, resultState, token, triggeredInput]: [
            IT,
            InternalResultType<IT, InternalEffectResult<RT>>,
            object | null,
            IT | NoValueTriggeredInput,
          ]) =>
            config.withTrigger && input !== triggeredInput
              ? store.getEventStream(inIds.trigger).pipe(
                  map(() => ({
                    type: triggeredInputEvent,
                    event: input,
                  })),
                )
              : internalResultEffect(
                  input,
                  store,
                  resultState.resultInput,
                  isNotNoValueType(resultState.result) ? resultState.result.result : NO_VALUE,
                ).pipe(
                  switchMap((result: InternalEffectResult<RT>) =>
                    of(
                      {
                        type: resultEvent,
                        event: {
                          // InternalResultType<IT, InternalEffectResult<RT>>
                          result,
                          resultInput: input,
                          resultToken: token,
                        },
                      },
                      {
                        type: outIds.successes,
                        event: {
                          // EffectSuccess<IT, RT>
                          result: result.result,
                          resultInput: input,
                          previousInput: resultState.resultInput,
                          previousResult: isNotNoValueType(resultState.result)
                            ? resultState.result.result
                            : NO_VALUE,
                          completed: result.completed,
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
                          result: NO_VALUE,
                          resultInput: input,
                          resultError: error,
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

    const getIsPending = config.withTrigger
      ? ([input, resultState, token, triggeredInput]: [
          IT,
          InternalResultType<IT, InternalEffectResult<RT>>,
          object | null,
          IT | NoValueTriggeredInput,
        ]) =>
          input === triggeredInput &&
          (token !== resultState.resultToken ||
            resultState.resultInput === NO_VALUE ||
            !effectInputEquals(input, resultState.resultInput) ||
            (isNotNoValueType(resultState.result) && !resultState.result.completed))
      : ([input, resultState, token]: [
          IT,
          InternalResultType<IT, InternalEffectResult<RT>>,
          object | null,
          IT | NoValueTriggeredInput,
        ]) =>
          token !== resultState.resultToken ||
          resultState.resultInput === NO_VALUE ||
          !effectInputEquals(input, resultState.resultInput) ||
          (isNotNoValueType(resultState.result) && !resultState.result.completed);

    store.addDerivedState(
      outIds.combined,
      combined.pipe(
        map(([input, resultState, token, triggeredInput]) =>
          getIsPending([input, resultState, token, triggeredInput])
            ? {
                currentInput: input,
                result: isNotNoValueType(resultState.result) ? resultState.result.result : NO_VALUE,
                resultInput: resultState.resultInput,
                resultPending: true,
              }
            : {
                currentInput: input,
                result: isNotNoValueType(resultState.result) ? resultState.result.result : NO_VALUE,
                resultInput: resultState.resultInput,
                resultError: resultState.resultError,
                resultPending: false,
                ...(resultState.resultError ? { resultError: resultState.resultError } : {}),
              },
        ),
      ),
      config.initialResultGetter
        ? {
            currentInput: NO_VALUE,
            result: config.initialResultGetter(),
            resultInput: NO_VALUE,
            resultPending: false,
          }
        : NO_VALUE,
    );

    store.addDerivedState(
      outIds.result,
      store.getBehavior(outIds.combined).pipe(filter(isCombinedEffectResultInSuccessState)),
    );

    store.addDerivedState(
      outIds.pending,
      store.getBehavior(outIds.combined).pipe(map(c => c.resultPending)),
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
 * This type specifies a {@link SignalsFactory} wrapping {@link EffectSignals}.
 *
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
 * This function creates an {@link EffectSignalsFactory}.
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
