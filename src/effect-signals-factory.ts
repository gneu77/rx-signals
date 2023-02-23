import {
  Observable,
  combineLatest,
  debounceTime,
  filter,
  map,
  of,
  switchMap,
  take,
  throwError,
} from 'rxjs';
import {
  EffectError,
  EffectResult,
  ToEffectError,
  isEffectError,
  isNotEffectError,
  toEffectError,
} from './effect-result';
import { Signals, SignalsFactory } from './signals-factory';
import { Effect, SafeEffectResult, Store, UnhandledEffectError } from './store';
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
 * @template Error - specifies the error type of the effect
 */
export type CombinedEffectResult<Input, Result, Error> = {
  /**
   * The current input (which might differ from the resultInput),
   * or `NO_VALUE`, if no input was received yet
   */
  currentInput: Input | NoValueType;

  /**
   * The current effect-result,
   * or `NO_VALUE` if no result was received yet,
   * or the effect produced an error
   */
  result: SafeEffectResult<Result, Error> | NoValueType;

  /**
   * The input that produced the current effect-result,
   * or `NO_VALUE`, if initial result or no result received yet */
  resultInput: Input | NoValueType;

  /**
   * Indicates whether the effect is currently running.
   * In case of a factory without trigger, this will be true whenever one or multiple
   * of the following conditions are met:
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
 * @template Error - specifies the error type of the effect
 */
export type CombinedEffectResultInErrorState<Input, Error> = {
  currentInput: Input;
  result: ToEffectError<Error> | EffectError<UnhandledEffectError>;
  resultInput: Input;
  resultPending: false;
};

/**
 * Typeguard to check if a {@link CombinedEffectResult} is a {@link CombinedEffectResultInErrorState}
 */
export const isCombinedEffectResultInErrorState = <Input, Result, Error>(
  cer: CombinedEffectResult<Input, Result, Error>,
): cer is CombinedEffectResultInErrorState<Input, Error> => isEffectError(cer.result);

/**
 * Type representing a {@link CombinedEffectResult} in it's success state (pending or non-pending)
 *
 * @template Input - specifies the input type for the effect
 * @template Result - specifies the result type of the effect
 */
export type CombinedEffectResultInSuccessState<Input, Result> = {
  currentInput: Input | NoValueType;
  result: Result;
  resultInput: Input | NoValueType;
  resultPending: boolean;
};

/**
 * Typeguard to check if a {@link CombinedEffectResult} is a {@link CombinedEffectResultInSuccessState}
 */
export const isCombinedEffectResultInSuccessState = <Input, Result, Error>(
  cer: CombinedEffectResult<Input, Result, Error>,
): cer is CombinedEffectResultInSuccessState<Input, Result> => isNotEffectError(cer.result);

/**
 * Type representing a {@link CombinedEffectResult} in it's success state (non-pending, hece completed effect)
 *
 * @template Input - specifies the input type for the effect
 * @template Result - specifies the result type of the effect
 */
export type CombinedEffectResultInCompletedSuccessState<Input, Result> = {
  currentInput: Input | NoValueType;
  result: Result;
  resultInput: Input | NoValueType;
  resultPending: false;
};

/**
 * Typeguard to check if a {@link CombinedEffectResult} is a {@link CombinedEffectResultInCompletedSuccessState}
 */
export const isCombinedEffectResultInCompletedSuccessState = <Input, Result, Error>(
  cer: CombinedEffectResult<Input, Result, Error>,
): cer is CombinedEffectResultInCompletedSuccessState<Input, Result> =>
  isNotEffectError(cer.result) && !cer.resultPending;

/**
 * Value-type for result events produced by {@link EffectSignals}.
 * In case the effect completes after one result, two reult events will
 * be dispatched, one with completed false and one with completed true.
 * This is to handle cases where the effect might send multiple results
 * before completing. Thus, if an effect never completes, all result events
 * will have completed false.
 *
 * @template Input - specifies the input type for the effect
 * @template Result - specifies the result type of the effect
 * @template Error - specifies the error type of the effect
 */
export type EffectResultEvent<Input, Result, Error> = {
  /** the effect result */
  result: SafeEffectResult<Result, Error>;

  /** the effect input that lead to the result */
  resultInput: Input;

  /** the input of the previous completed result, or `NO_VALUE` */
  // previousInput: Input | NoValueType;

  /** the previous completed result, or `NO_VALUE` */
  // previousResult: SafeEffectResult<Result, Error> | NoValueType;

  /** has the effect for the given resultInput completed */
  completed: boolean;
};

/**
 * Value-type for completed result events produced by {@link EffectSignals}.
 * In contrast to {@link EffectResultEvent}, events with this type are only dispatched,
 * if the effect has completed, hence it will never be fired for effects that never complete.
 *
 * @template Input - specifies the input type for the effect
 * @template Result - specifies the result type of the effect
 * @template Error - specifies the error type of the effect
 */
export type EffectCompletedResultEvent<Input, Result, Error> = Omit<
  EffectResultEvent<Input, Result, Error>,
  'completed'
> & { completed: true };

/**
 * Typeguard to check if a {@link EffectResultEvent} is a {@link EffectCompletedResultEvent}
 */
export const isCompletedResultEvent = <Input, Result, Error>(
  value: EffectCompletedResultEvent<Input, Result, Error> | EffectResultEvent<Input, Result, Error>,
): value is EffectCompletedResultEvent<Input, Result, Error> => value.completed;

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
 * The {@link EffectSignalsFactory} takes care that subscribing the result-events keeps
 * the effect itself lazy (hence only subscribing the combined behavior will subscribe the effect itself)!
 *
 * @template Input - specifies the input type for the effect
 * @template Result - specifies the result type of the effect
 * @template Error - specifies the error type of the effect
 */
export type EffectOutputSignals<Input, Result, Error> = {
  /** Produced combined effect result behavior */
  combined: DerivedId<CombinedEffectResult<Input, Result, Error>>;

  /** Produced success events */
  results: EventId<EffectResultEvent<Input, Result, Error>>;

  /** Produced success events */
  completedResults: EventId<EffectCompletedResultEvent<Input, Result, Error>>;
};

/**
 * Type specifying the effect-type of {@link EffectSignals} (the corresponding effects are NOT added to the store
 * by the EffectSignals-setup, but by whoever uses the signals, e.g. by `useExistingEffect` or via extended configuration plus `extendSetup`).
 *
 * @template Input - specifies the input type for the effect
 * @template Result - specifies the result type of the effect
 * @template Error - specifies the error type of the effect
 */
export type EffectFactoryEffects<Input, Result, Error> = {
  id: EffectId<Input, Result, Error>;
};

/**
 * This type specifies generic effect signals. `EffectSignals` generically handle side-effects (hence, are an abstraction over side-effects).
 * They fulfill the following requirements:
 * ```markdown
 * 1.) The produced CombinedEffectResult<Input, Result, Error> behavior must be lazy, hence, as long as it is not subscribed,
 *     no effect will be triggered (so subscribing just results, or completedResults will not trigger the effect).
 * 2.) Unhandled effect errors are caught and will lead to an EffectError<UnhandledEffectError>.
 * 3.) In addition to the combined-behavior, also event-streams for EffectResultEvent and EffectCompletedResultEvent are provided. This is important
 *     in cases where e.g. an effect success should be used to trigger something else (e.g. close a popup), but you cannot use the result
 *     behavior, because it would mean to always subscribe the result. In contrast, subscription of the an rsult-event-stream will NOT
 *     subscribe the effect.
 * ```
 *
 * See the documentation for {@link EffectConfiguration} for further configuration of `EffectSignals`.
 *
 * @template Input - specifies the input type for the effect
 * @template Result - specifies the result type of the effect
 * @template Error - specifies the error type of the effect
 */
export type EffectSignals<Input, Result, Error> = Signals<
  EffectInputSignals<Input>,
  EffectOutputSignals<Input, Result, Error>,
  EffectFactoryEffects<Input, Result, Error>
>;

/**
 * This type specifies the type of the argument to {@link EffectSignalsBuild}, hence the configuration of {@link EffectSignals}.
 *
 * @template Input - specifies the input type for the effect
 * @template Result - specifies the result type of the effect
 * @template Error - specifies the error type of the effect
 */
export type EffectConfiguration<Input, Result, Error> = {
  /** Function used to determine whether a new input equals the previous one. Defaults to strict equals (`a === b`) */
  effectInputEquals?: (a: Input, b: Input) => boolean;

  /** Defaults to false. If true, the effect will only be performed in case a trigger event is received (else, whenever the input changes) */
  withTrigger?: boolean;

  /** If defined, this function will be used to determine an initial result for the result behavior */
  initialResultGetter?: () => Result;

  /** If defined and `>0`, then it will be used as milliseconds to debounce new input to the effect (please DON'T debounce the input signal yourself, because that would debounce before trigger and/or input equals!) */
  effectDebounceTime?: number;

  /** Function to wrap the effect defined by effectId with a custom `Effect` */
  wrappedEffectGetter?: (effect: Effect<Input, Result, Error>) => Effect<Input, Result, Error>;

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
 * @template Error - specifies the error type of the effect
 * @param {EffectConfiguration<Input, Result, Error>} config - the configuration for the `EffectSignals`
 */
export type EffectSignalsBuild = <Input, Result, Error>(
  config: EffectConfiguration<Input, Result, Error>,
) => EffectSignals<Input, Result, Error>;

const getInputSignalIds = <Input>(nameExtension?: string): EffectInputSignals<Input> => ({
  input: getDerivedId<Input>(`${nameExtension ?? ''}_input`),
  invalidate: getEventId<undefined>(`${nameExtension ?? ''}_invalidate`),
  trigger: getEventId<undefined>(`${nameExtension ?? ''}_trigger`),
});

const getOutputSignalIds = <Input, Result, Error>(
  nameExtension?: string,
): EffectOutputSignals<Input, Result, Error> => ({
  combined: getDerivedId<CombinedEffectResult<Input, Result, Error>>(
    `${nameExtension ?? ''}_combined`,
  ),
  results: getEventId<EffectResultEvent<Input, Result, Error>>(`${nameExtension ?? ''}_results`),
  completedResults: getEventId<EffectCompletedResultEvent<Input, Result, Error>>(
    `${nameExtension ?? ''}_completedResults`,
  ),
});

const NO_VALUE_TRIGGERED_INPUT = '$RXS_INTERNAL_NV_TI$';
type NoValueTriggeredInput = typeof NO_VALUE_TRIGGERED_INPUT;

type InternalEffectResult<RT, Error> = {
  result: SafeEffectResult<RT, Error>;
  completed: boolean;
};

type InternalResultType<Input, R> = {
  result: R | NoValueType;
  resultInput: Input | NoValueType;
  resultToken: object | null;
};

const getIsNewInput =
  <Input, Result, Error>(effectInputEquals: (a: Input, b: Input) => boolean) =>
  ([input, resultState, token]: [
    Input,
    InternalResultType<Input, InternalEffectResult<Result, Error>>,
    object | null,
    Input | NoValueTriggeredInput,
  ]): boolean =>
    token !== resultState.resultToken ||
    isNoValueType(resultState.resultInput) ||
    !effectInputEquals(input, resultState.resultInput);

const getEffectBuilder: EffectSignalsBuild = <IT, RT, ER>(
  config: EffectConfiguration<IT, RT, ER>,
): EffectSignals<IT, RT, ER> => {
  const effectId = getEffectId<IT, RT, ER>();
  const wrappedResultEffect = (
    input: IT,
    args: {
      store: Store;
      previousInput: IT | NoValueType;
      previousResult: SafeEffectResult<RT, ER> | NoValueType;
    },
  ) =>
    args.store.getEffect(effectId).pipe(
      take(1),
      switchMap(effect => {
        try {
          const wrappedEffect = config.wrappedEffectGetter
            ? config.wrappedEffectGetter(effect)
            : effect;
          return wrappedEffect(input, args);
        } catch (error) {
          return throwError(() => error);
        }
      }),
    );
  const internalResultEffect = (
    input: IT,
    args: {
      store: Store;
      previousInput: IT | NoValueType;
      previousResult: SafeEffectResult<RT, ER> | NoValueType;
    },
  ): Observable<InternalEffectResult<RT, ER>> =>
    new Observable<InternalEffectResult<RT, ER>>(subscriber => {
      let currentResult: EffectResult<RT, ER> | NoValueType = NO_VALUE;
      const subscription = wrappedResultEffect(input, args).subscribe({
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
          subscriber.next({
            result: toEffectError<UnhandledEffectError>({
              unhandledError: e,
            }),
            completed: true,
          });
          subscriber.complete();
          currentResult = NO_VALUE;
        },
      });
      return () => {
        subscription.unsubscribe();
        currentResult = NO_VALUE;
      };
    });

  const effectInputEquals = config.effectInputEquals ?? ((a, b) => a === b);
  const isNewInput = getIsNewInput<IT, RT, ER>(effectInputEquals);

  const inIds = getInputSignalIds<IT>(config.nameExtension);
  const outIds = getOutputSignalIds<IT, RT, ER>(config.nameExtension);
  const setup = (store: Store) => {
    const invalidateTokenBehavior = getStateId<object | null>();
    store.addState(invalidateTokenBehavior, null);
    store.addReducer(invalidateTokenBehavior, inIds.invalidate, () => ({}));

    const internalInput = config.eagerInputSubscription === true ? getStateId<IT>() : inIds.input;
    if (internalInput !== inIds.input) {
      store.connect(inIds.input, internalInput);
    }

    const resultEvent = getEventId<InternalResultType<IT, InternalEffectResult<RT, ER>>>();
    const resultBehavior = getDerivedId<InternalResultType<IT, InternalEffectResult<RT, ER>>>();
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
      outIds.completedResults,
      store.getEventStream(outIds.results).pipe(filter(isCompletedResultEvent)),
    );

    // It is important to setup the combined observable as behavior,
    // because a simple shareReplay (even with refCount) could create a memory leak!!!
    const combinedId =
      getDerivedId<
        [
          IT,
          InternalResultType<IT, InternalEffectResult<RT, ER>>,
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

    store.add3TypedEventSource(
      resultEvent,
      triggeredInputEvent,
      outIds.results,
      eventSourceInput.pipe(
        filter(isNewInput),
        switchMap(
          ([input, resultState, token, triggeredInput]: [
            IT,
            InternalResultType<IT, InternalEffectResult<RT, ER>>,
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
              : internalResultEffect(input, {
                  store,
                  previousInput: resultState.resultInput,
                  previousResult: isNotNoValueType(resultState.result)
                    ? resultState.result.result
                    : NO_VALUE,
                }).pipe(
                  switchMap((result: InternalEffectResult<RT, ER>) =>
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
                        type: outIds.results,
                        event: {
                          // EffectResultEvent<IT, RT, ER>
                          result: result.result,
                          resultInput: input,
                          // previousInput: resultState.resultInput,
                          // previousResult: isNotNoValueType(resultState.result)
                          //   ? resultState.result.result
                          //   : NO_VALUE,
                          completed: result.completed,
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
          InternalResultType<IT, InternalEffectResult<RT, ER>>,
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
          InternalResultType<IT, InternalEffectResult<RT, ER>>,
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
                resultPending: false,
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
 * @template Error - specifies the error type of the effect
 */
export type EffectSignalsFactory<Input, Result, Error> = SignalsFactory<
  EffectInputSignals<Input>,
  EffectOutputSignals<Input, Result, Error>,
  EffectConfiguration<Input, Result, Error>,
  EffectFactoryEffects<Input, Result, Error>
>;

/**
 * This function creates an {@link EffectSignalsFactory}.
 *
 * @template Input - specifies the input type for the effect
 * @template Result - specifies the result type of the effect
 * @template Error - specifies the error type of the effect
 * @returns {EffectSignalsFactory<Input, Result>}
 */
export const getEffectSignalsFactory = <Input, Result, Error>(): EffectSignalsFactory<
  Input,
  Result,
  Error
> =>
  new SignalsFactory<
    EffectInputSignals<Input>,
    EffectOutputSignals<Input, Result, Error>,
    EffectConfiguration<Input, Result, Error>,
    EffectFactoryEffects<Input, Result, Error>
  >(getEffectBuilder);
