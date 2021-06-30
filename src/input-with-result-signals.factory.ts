import { combineLatest, Observable, of, throwError } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  switchMap,
} from 'rxjs/operators';
import { NO_VALUE } from './source-observable';
import { Store, TypeIdentifier } from './store';
import {
  EffectType,
  getIdentifier,
  SignalsFactory,
  SignalsFactoryOptions,
  UnhandledEffectErrorEvent,
} from './store.utils';

export interface InputWithResult<InputModel, ResultModel> {
  readonly currentInput?: InputModel;
  readonly resultInput?: InputModel;
  readonly result?: ResultModel;
  readonly resultPending: boolean; // true, if the current input differs from resultInput
  readonly unhandledResultEffectError: any | null;
}

export interface InputWithResultSignals<InputModel, ResultModel> extends SignalsFactory {
  readonly inputWithResultBehaviorId: TypeIdentifier<InputWithResult<InputModel, ResultModel>>;
  readonly resultPendingBehaviorId: TypeIdentifier<boolean>;
  readonly invalidateResultEventId: TypeIdentifier<void>;
  readonly triggerResultEffectEventId: TypeIdentifier<void>;
  readonly unhandledResultEffectErrorEventId: TypeIdentifier<UnhandledEffectErrorEvent<InputModel>>;
}

export interface InputWithResultSignalsFactoryOptions<InputModel, ResultModel>
  extends SignalsFactoryOptions<InputModel> {
  readonly initialResult?: ResultModel;
  readonly withTriggerEvent?: boolean;
}

interface InternalRequest<InputModel, ResultModel> {
  readonly input: InputModel | symbol;
  readonly resultInput: InputModel | symbol;
  readonly token: object | null;
  readonly resultToken: object | null;
  readonly result: ResultModel | symbol;
  readonly unhandledResultEffectError: any | null;
}

interface InternalResultEvent<InputModel, ResultModel> {
  readonly resultInput: InputModel;
  readonly unhandledResultEffectError: any | null;
  readonly result: ResultModel | symbol;
}

export const prepareInputWithResultSignals = <InputModel, ResultModel>(
  inputObservableGetter: (store: Store) => Observable<InputModel>,
  resultEffect: EffectType<InputModel, ResultModel>,
  options: InputWithResultSignalsFactoryOptions<InputModel, ResultModel> = {},
): InputWithResultSignals<InputModel, ResultModel> => {
  const inputEquals: (prevInput?: InputModel, nextInput?: InputModel) => boolean =
    options.inputEquals ?? ((prev, next) => prev === next);
  const internalRequestInputChanged: (a: InputModel | symbol, b: InputModel | symbol) => boolean = (
    input: InputModel | symbol,
    resultInput: InputModel | symbol,
  ) =>
    input !== NO_VALUE &&
    (resultInput === NO_VALUE || !inputEquals(input as InputModel, resultInput as InputModel));
  const withTriggerEvent: boolean = options.withTriggerEvent ?? false;
  const identifierNamePrefix = options.identifierNamePrefix ?? '';
  const inputDebounceTime = options.inputDebounceTime ?? 10;
  const initialResult = options.initialResult ?? NO_VALUE;
  const internalResultEffect = (
    input: InputModel,
    store: Store,
    previousInput?: InputModel,
    previousResult?: ResultModel,
  ) => {
    try {
      return resultEffect(input, store, previousInput, previousResult);
    } catch (error) {
      return throwError(error);
    }
  };

  const inputWithResultBehaviorId = getIdentifier<InputWithResult<InputModel, ResultModel>>(
    `${identifierNamePrefix}_InputWithResult`,
  );
  const resultPendingBehaviorId = getIdentifier<boolean>(`${identifierNamePrefix}_ResultPending`);
  const invalidateResultEventId = getIdentifier<void>(
    `${identifierNamePrefix}_InvalidateAndTriggerEvent`,
  );
  const triggerResultEffectEventId = invalidateResultEventId;
  const unhandledResultEffectErrorEventId = getIdentifier<UnhandledEffectErrorEvent<InputModel>>(
    `${identifierNamePrefix}_ResultErrorEvent`,
  );

  const internalRequestBehaviorId = getIdentifier<InternalRequest<InputModel, ResultModel>>();
  const internalRequestEventId = getIdentifier<InputModel | symbol>();
  const internalResultEventId = getIdentifier<InternalResultEvent<InputModel, ResultModel>>();

  const initialInternalRequest: InternalRequest<InputModel, ResultModel> = {
    input: NO_VALUE,
    resultInput: NO_VALUE,
    token: null,
    resultToken: null,
    result: NO_VALUE,
    unhandledResultEffectError: null,
  };

  return {
    inputWithResultBehaviorId,
    resultPendingBehaviorId,
    invalidateResultEventId,
    triggerResultEffectEventId,
    unhandledResultEffectErrorEventId,
    setup: (store: Store) => {
      store.addState(internalRequestBehaviorId, initialInternalRequest);
      store.addReducer(internalRequestBehaviorId, invalidateResultEventId, state => ({
        ...state,
        token: {},
      }));
      store.addReducer(internalRequestBehaviorId, internalRequestEventId, (state, event) => ({
        ...state,
        input: event,
        resultToken: state.token,
      }));
      store.addReducer(internalRequestBehaviorId, internalResultEventId, (state, event) => ({
        ...state,
        ...event,
        resultToken: state.token,
      }));
      store.addEventSource(
        Symbol(''),
        unhandledResultEffectErrorEventId,
        store.getEventStream(internalResultEventId).pipe(
          filter(event => event.unhandledResultEffectError !== null),
          map(event => ({
            input: event.resultInput,
            error: event.unhandledResultEffectError,
          })),
        ),
      );
      store.addEventSource(
        Symbol(''),
        internalResultEventId,
        store.getBehavior(internalRequestBehaviorId).pipe(
          filter(state => state.input !== NO_VALUE),
          filter(state =>
            withTriggerEvent
              ? state.token !== state.resultToken &&
                internalRequestInputChanged(state.input, state.resultInput)
              : state.token !== state.resultToken ||
                internalRequestInputChanged(state.input, state.resultInput),
          ),
          switchMap(state =>
            internalResultEffect(
              state.input as InputModel,
              store,
              state.resultInput === NO_VALUE ? undefined : (state.resultInput as InputModel),
              state.resultInput === NO_VALUE ? undefined : (state.result as ResultModel),
            ).pipe(
              map(result => ({
                resultInput: state.input as InputModel,
                result,
                unhandledResultEffectError: null,
              })),
              catchError(error =>
                of({
                  resultInput: state.input as InputModel,
                  result: NO_VALUE,
                  unhandledResultEffectError: error,
                }),
              ),
            ),
          ),
        ),
      );

      const combinedInput = combineLatest([
        inputObservableGetter(store).pipe(distinctUntilChanged(), debounceTime(inputDebounceTime)),
        store.getBehavior(internalRequestBehaviorId),
      ]);

      store.addLazyBehavior(
        inputWithResultBehaviorId,
        combinedInput.pipe(
          map(([input, state]) => {
            if (internalRequestInputChanged(input, state.input)) {
              store.dispatchEvent(internalRequestEventId, input);
            }
            const noValueResult: ResultModel | undefined =
              initialResult === NO_VALUE ? undefined : (initialResult as ResultModel);
            return {
              currentInput: input,
              resultInput:
                state.resultInput === NO_VALUE ? undefined : (state.resultInput as InputModel),
              result: state.result === NO_VALUE ? noValueResult : (state.result as ResultModel),
              resultPending: withTriggerEvent
                ? state.token !== state.resultToken &&
                  internalRequestInputChanged(input, state.resultInput)
                : state.token !== state.resultToken ||
                  internalRequestInputChanged(input, state.resultInput),
              unhandledResultEffectError: state.unhandledResultEffectError,
            };
          }),
          distinctUntilChanged(
            (a, b) =>
              a.result === b.result &&
              a.resultPending === b.resultPending &&
              a.unhandledResultEffectError === b.unhandledResultEffectError &&
              a.currentInput === b.currentInput &&
              inputEquals(a.resultInput, b.resultInput),
          ),
        ),
        initialResult === NO_VALUE
          ? NO_VALUE
          : {
              result: initialResult as ResultModel,
              resultPending: false,
              unhandledResultEffectError: null,
            },
      );

      store.addLazyBehavior(
        resultPendingBehaviorId,
        store.getBehavior(inputWithResultBehaviorId).pipe(map(r => r.resultPending)),
      );
    },
  };
};
