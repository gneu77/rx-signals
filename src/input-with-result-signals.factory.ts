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
import { EffectType, getIdentifier, SignalsFactory, SignalsFactoryOptions } from './store.utils';

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
}

export interface InputWithResultSignalsFactoryOptions<InputModel, ResultModel>
  extends SignalsFactoryOptions<InputModel> {
  readonly initialResult?: ResultModel;
  readonly withTriggerEvent?: boolean;
}

interface InternalResult<InputModel, ResultModel> {
  readonly resultInput: InputModel | symbol;
  readonly resultResultToken: object | null;
  readonly result?: ResultModel;
  readonly unhandledResultEffectError: any | null;
}

export const prepareInputWithResultSignals = <InputModel, ResultModel>(
  inputObservableGetter: (store: Store) => Observable<InputModel>,
  resultEffect: EffectType<InputModel, ResultModel>,
  options: InputWithResultSignalsFactoryOptions<InputModel, ResultModel> = {},
): InputWithResultSignals<InputModel, ResultModel> => {
  const inputEquals: (prevInput?: InputModel, nextInput?: InputModel) => boolean =
    options.inputEquals ?? ((prev, next) => prev === next);
  const internalInputEquals = (newInput?: InputModel, stateInput?: InputModel | symbol) =>
    stateInput === newInput ||
    (stateInput !== NO_VALUE && inputEquals(stateInput as InputModel, newInput));
  const withTriggerEvent: boolean = options.withTriggerEvent ?? false;
  const internalResultInputEquals = withTriggerEvent
    ? (
        input: InputModel,
        resultToken: object | null,
        state: InternalResult<InputModel, ResultModel>,
      ) => resultToken === state.resultResultToken || internalInputEquals(input, state.resultInput)
    : (
        input: InputModel,
        resultToken: object | null,
        state: InternalResult<InputModel, ResultModel>,
      ) => resultToken === state.resultResultToken && internalInputEquals(input, state.resultInput);
  const identifierNamePrefix = options.identifierNamePrefix ?? '';
  const inputDebounceTime = options.inputDebounceTime ?? 50;
  const initialResult = options.initialResult ?? NO_VALUE;
  const internalResultEffect = (input: InputModel, store: Store) => {
    try {
      return resultEffect(input, store);
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

  const resultTokenBehaviorId = getIdentifier<object | null>(`${identifierNamePrefix}_ResultToken`);
  const internalResultBehaviorId = getIdentifier<InternalResult<InputModel, ResultModel>>(
    `${identifierNamePrefix}_InternalResult`,
  );

  const initialInternalResult: InternalResult<InputModel, ResultModel> = {
    resultInput: NO_VALUE,
    result: initialResult === NO_VALUE ? undefined : (initialResult as ResultModel),
    resultResultToken: null,
    unhandledResultEffectError: null,
  };

  return {
    inputWithResultBehaviorId,
    resultPendingBehaviorId,
    invalidateResultEventId,
    triggerResultEffectEventId,
    setup: (store: Store) => {
      store.addNonLazyBehavior(
        // invalidation must be possible while result is unsubscribed, hence this must be non-lazy!
        resultTokenBehaviorId,
        store.getEventStream(invalidateResultEventId).pipe(
          map(() => ({})), // cannot use mapTo, because RxJs would optimize this to always return the same object!
        ),
        null,
      );

      const combinedInput = combineLatest([
        inputObservableGetter(store).pipe(distinctUntilChanged(), debounceTime(inputDebounceTime)),
        store.getBehavior(resultTokenBehaviorId),
        store.getBehavior(internalResultBehaviorId),
      ]);

      store.addLazyBehavior(
        internalResultBehaviorId,
        combinedInput.pipe(
          filter(
            ([input, resultToken, state]) => !internalResultInputEquals(input, resultToken, state),
          ), // NoOp, if we already have a result for the input, or if trigger event has not been sent in case of withTriggerEvent
          switchMap(([input, resultToken]) =>
            internalResultEffect(input, store).pipe(
              map(result => ({
                resultInput: input,
                result,
                unhandledResultEffectError: null,
                resultResultToken: resultToken,
              })),
              catchError(error =>
                of({
                  resultInput: input,
                  unhandledResultEffectError: error,
                  resultResultToken: resultToken,
                }),
              ),
            ),
          ),
        ),
        initialInternalResult,
      );

      store.addLazyBehavior(
        inputWithResultBehaviorId,
        combinedInput.pipe(
          map(([input, resultToken, state]) => ({
            currentInput: input,
            resultInput:
              state.resultInput === NO_VALUE ? undefined : (state.resultInput as InputModel),
            result:
              state.resultInput === NO_VALUE && initialResult === NO_VALUE
                ? undefined
                : state.result,
            resultPending: !internalResultInputEquals(input, resultToken, state),
            unhandledResultEffectError: state.unhandledResultEffectError,
          })),
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
