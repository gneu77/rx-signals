import { combineLatest, Observable, of, throwError } from 'rxjs';
import { catchError, debounceTime, filter, map, mapTo, switchMap } from 'rxjs/operators';
import { Signals, SignalsFactory, signalsFactoryBind, signalsFactoryMap } from './signals-factory';
import { NO_VALUE } from './source-observable';
import { Store, TypeIdentifier } from './store';
import { EffectType, getIdentifier } from './store.utils';

export interface CombinedEffectResult<InputType, ResultType> {
  readonly currentInput?: InputType;
  readonly result?: ResultType;
  readonly resultInput?: InputType;
  readonly resultPending: boolean;
}

export interface EffectError<InputType> {
  readonly error: any;
  readonly errorInput: InputType;
}

export interface EffectSignalsType<InputType, ResultType> {
  readonly combinedBehavior: TypeIdentifier<CombinedEffectResult<InputType, ResultType>>;
  readonly errorEvents: TypeIdentifier<EffectError<InputType>>;
  readonly invalidateEvent: TypeIdentifier<void>;
}

export interface TriggeredEffectSignalsType<InputType, ResultType>
  extends EffectSignalsType<InputType, ResultType> {
  readonly triggerEvent: TypeIdentifier<void>;
}

const getSignalIds = <InputType, ResultType>(): TriggeredEffectSignalsType<
  InputType,
  ResultType
> => ({
  combinedBehavior: getIdentifier<CombinedEffectResult<InputType, ResultType>>(),
  errorEvents: getIdentifier<EffectError<InputType>>(),
  invalidateEvent: getIdentifier<void>(),
  triggerEvent: getIdentifier<void>(),
});

interface EffectFactoryConfiguration<InputType, ResultType> {
  inputGetter: (store: Store) => Observable<InputType>;
  effect: EffectType<InputType, ResultType>;
  effectInputEquals: (a: InputType, b: InputType) => boolean;
  withTrigger?: boolean;
  initialResultGetter?: () => ResultType;
  effectDebounceTime?: number;
}

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

      // It is important to setup the combined observable as behavior, because a simple shareReplay (event with refCount) creates a memory leak!!!
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

      store.add3TypedEventSource(
        Symbol(''),
        resultEvent,
        triggeredInputEvent,
        ids.errorEvents,
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
                  map(result => ({
                    type: resultEvent,
                    event: {
                      result,
                      resultInput: input,
                      resultToken: token,
                    },
                  })),
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
      signals: ((config.withTrigger ? ids : withoutTriggerID) as unknown) as SignalsType,
    };
  };
  return build;
};

export interface EffectSignalsFactory<InputType, ResultType, SignalsType>
  extends SignalsFactory<SignalsType> {
  withTrigger: () => EffectSignalsFactory<
    InputType,
    ResultType,
    TriggeredEffectSignalsType<InputType, ResultType>
  >;
  withInitialResult: (
    resultGetter: () => ResultType,
  ) => EffectSignalsFactory<InputType, ResultType, SignalsType>;
  withEffectDebounce: (
    debounceMS: number,
  ) => EffectSignalsFactory<InputType, ResultType, SignalsType>;
  withCustomEffectInputEquals: (
    effectInputEquals: (a: InputType, b: InputType) => boolean,
  ) => EffectSignalsFactory<InputType, ResultType, SignalsType>;
}

const getEffectSignalsFactoryIntern = <
  InputType,
  ResultType,
  SignalsType extends EffectSignalsType<InputType, ResultType>
>(
  config: EffectFactoryConfiguration<InputType, ResultType>,
): EffectSignalsFactory<InputType, ResultType, SignalsType> => {
  const builder = getEffectBuilder<InputType, ResultType, SignalsType>();
  let factory: EffectSignalsFactory<InputType, ResultType, SignalsType>;
  const build = (): Signals<SignalsType> => builder(config);
  const bind = <SignalsType2>(
    mapper: (signals: Signals<SignalsType>) => SignalsFactory<SignalsType2>,
  ) => signalsFactoryBind(factory, mapper);
  const fmap = <SignalsType2>(mapper: (signals: Signals<SignalsType>) => Signals<SignalsType2>) =>
    signalsFactoryMap(factory, mapper);
  const withTrigger = () =>
    getEffectSignalsFactoryIntern<
      InputType,
      ResultType,
      TriggeredEffectSignalsType<InputType, ResultType>
    >({
      ...config,
      withTrigger: true,
    });
  const withInitialResult = (resultGetter: () => ResultType) =>
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
  factory = {
    build,
    bind,
    fmap,
    withTrigger,
    withInitialResult,
    withEffectDebounce,
    withCustomEffectInputEquals,
  };
  return factory;
};

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
