import { combineLatest, Observable, of, throwError } from 'rxjs';
import { catchError, filter, map, mapTo, switchMap } from 'rxjs/operators';
import { Store, TypeIdentifier } from './store';
import { EffectType, getIdentifier } from './store.utils';

export interface CombinedEffectResult<InputType, ResultType> {
  readonly currentInput: InputType;
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
  readonly pendingBehavior: TypeIdentifier<boolean>;
  readonly invalidateEvent: TypeIdentifier<void>;
}

export interface TriggeredEffectSignalsType {
  readonly triggerEvent: TypeIdentifier<void>;
}

export interface SetupWithStore {
  readonly setup: (store: Store) => void;
}

export interface ComposedSignals<SignalsType, ParentSignalsType> {
  signals: SignalsType;
  parentSignals: ParentSignalsType;
}

export type Signals<SignalsType, ParentSignalsType> = SetupWithStore &
  ComposedSignals<SignalsType, ParentSignalsType>;

type FactoryBuild<SignalsType, ParentSignalsType> = () => Signals<SignalsType, ParentSignalsType>;

export interface EffectSignalsFactory<SignalsType, ParentSignalsType> {
  readonly build: FactoryBuild<SignalsType, ParentSignalsType>;
  readonly withTrigger: () => EffectSignalsFactory<
    SignalsType & TriggeredEffectSignalsType,
    ParentSignalsType
  >;
  // readonly map: <InputType2, ResultType2>(
  //   effect: EffectType<InputType2, ResultType2>,
  //   inputMapper: (
  //     store: Store,
  //     inputSignals: EffectSignalsType<InputType, ResultType>,
  //   ) => Observable<InputType2>,
  // ) => EffectSignalsFactory<
  //   CombinedEffectResult<InputType, ResultType>,
  //   ResultType2,
  //   EffectSignalsType<CombinedEffectResult<InputType, ResultType>, ResultType2>,
  //   EffectSignalsType<InputType, ResultType>
  // >;
}

interface FactoryConfig<InputType, ParentSignalsType, ParentParentSignalsType> {
  readonly withTrigger: boolean;
  readonly customInputEquals: null | ((input: InputType) => boolean);
  readonly parentBuild?: FactoryBuild<ParentSignalsType, ParentParentSignalsType>;
}

const getEffectSignals = <InputType, ResultType>(): EffectSignalsType<InputType, ResultType> => ({
  combinedBehavior: getIdentifier<CombinedEffectResult<InputType, ResultType>>(),
  errorEvents: getIdentifier<EffectError<InputType>>(),
  pendingBehavior: getIdentifier<boolean>(),
  invalidateEvent: getIdentifier<void>(),
});

const getTriggeredEffectSignals = <InputType, ResultType>(): EffectSignalsType<
  InputType,
  ResultType
> &
  TriggeredEffectSignalsType => ({
  ...getEffectSignals<InputType, ResultType>(),
  triggerEvent: getIdentifier<void>(),
});

const getBuilder = <IT, RT, ST, PST, PPST>(
  config: FactoryConfig<IT, PST, PPST>,
  inputGetter: (store: Store) => Observable<IT>,
  effect: EffectType<IT, RT>,
) => {
  const internalResultEffect = (
    input: IT,
    store: Store,
    previousInput?: IT,
    previousResult?: RT,
  ) => {
    try {
      return effect(input, store, previousInput, previousResult);
    } catch (error) {
      return throwError(error);
    }
  };
  const build: FactoryBuild<ST, PST | undefined> = () => {
    const parent = config.parentBuild ? config.parentBuild() : undefined;
    const parentSignals: PST | undefined = parent?.signals;
    const signals = config.withTrigger
      ? getTriggeredEffectSignals<IT, RT>()
      : getEffectSignals<IT, RT>();
    const setup = (store: Store) => {
      if (parent) {
        parent.setup(store);
      }

      const invalidateTokenBehavior = getIdentifier<object | null>();
      store.addNonLazyBehavior(
        invalidateTokenBehavior,
        store.getEventStream(signals.invalidateEvent).pipe(
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
      store.addLazyBehavior(resultBehavior, store.getEventStream(resultEvent), {
        resultToken: null,
      });

      const triggeredInputEvent = getIdentifier<IT>();
      const triggeredInputBehavior = getIdentifier<IT | null>();
      store.addLazyBehavior(
        triggeredInputBehavior,
        store.getEventStream(triggeredInputEvent),
        null,
      );

      const combined = combineLatest([
        inputGetter(store),
        store.getBehavior(resultBehavior),
        store.getBehavior(invalidateTokenBehavior),
        store.getBehavior(triggeredInputBehavior),
      ]);

      store.add3TypedEventSource(
        Symbol(''),
        resultEvent,
        triggeredInputEvent,
        signals.errorEvents,
        combined.pipe(
          filter(
            ([input, resultState, token]) =>
              input !== resultState.resultInput || token !== resultState.resultToken,
          ),
          switchMap(([input, resultState, token, triggeredInput]) =>
            config.withTrigger && input !== triggeredInput
              ? store
                  .getEventStream(
                    (signals as EffectSignalsType<IT, RT> & TriggeredEffectSignalsType)
                      .triggerEvent,
                  )
                  .pipe(
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
                        type: signals.errorEvents,
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
        signals.combinedBehavior,
        combined.pipe(
          map(([input, resultState, token, triggeredInput]) => ({
            currentInput: input,
            result: resultState.result,
            resultInput: resultState.resultInput,
            resultPending: config.withTrigger
              ? input === triggeredInput &&
                (input !== resultState.resultInput || token !== resultState.resultToken)
              : input !== resultState.resultInput || token !== resultState.resultToken,
          })),
        ),
      );

      store.addLazyBehavior(
        signals.pendingBehavior,
        store.getBehavior(signals.combinedBehavior).pipe(map(s => s.resultPending)),
      );
    };
    return {
      setup,
      signals: (signals as unknown) as ST,
      parentSignals,
    };
  };
  const withTrigger: () => EffectSignalsFactory<
    ST & TriggeredEffectSignalsType,
    PST | undefined
  > = () =>
    getBuilder<IT, RT, ST & TriggeredEffectSignalsType, PST, PPST>(
      {
        ...config,
        withTrigger: true,
      },
      inputGetter,
      effect,
    );
  return {
    build,
    withTrigger,
  };
};

export const getEffectSignalsFactory = <InputType, ResultType>(
  inputGetter: (store: Store) => Observable<InputType>,
  effect: EffectType<InputType, ResultType>,
): EffectSignalsFactory<EffectSignalsType<InputType, ResultType>, undefined> =>
  getBuilder<InputType, ResultType, EffectSignalsType<InputType, ResultType>, undefined, undefined>(
    {
      withTrigger: false,
      customInputEquals: null,
    },
    inputGetter,
    effect,
  );
