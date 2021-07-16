import { Observable } from 'rxjs';
import { distinctUntilChanged, filter, map } from 'rxjs/operators';
import { getEffectSignalsFactory } from './effect-signals-factory';
import { Store } from './store';
import { EffectType } from './store.utils';

export const getValidatedInputWithResultSignalsFactory = <InputType, ValidationType, ResultType>(
  inputGetter: (store: Store) => Observable<InputType>,
  validationEffect: EffectType<InputType, ValidationType>,
  isValidationResultValid: (validationResult: ValidationType) => boolean,
  resultEffect: EffectType<InputType, ResultType>,
) =>
  getEffectSignalsFactory<InputType, ValidationType>(inputGetter, validationEffect)
    .bind(validationSignals =>
      getEffectSignalsFactory<InputType, ResultType>(
        (store: Store) =>
          store.getBehavior(validationSignals.signals.combinedBehavior).pipe(
            filter(c => c.resultInput !== undefined && c.result !== undefined),
            filter(c => c.currentInput === c.resultInput),
            filter(c => isValidationResultValid(c.result as ValidationType)),
            map(c => c.resultInput),
            distinctUntilChanged(),
            map(resultInput => resultInput as InputType), // cast is OK, cause we checked for undefined in the first filter
          ),
        resultEffect,
      ).withTrigger(),
    )
    .fmap(signals => ({
      ...signals,
      signals: {
        validationCombinedBehavior: signals.signals.signals1.combinedBehavior,
        validationErrorEvents: signals.signals.signals1.errorEvents,
        validationInvalidateEvent: signals.signals.signals1.invalidateEvent,
        validationPendingBehavior: signals.signals.signals1.pendingBehavior,
        resultCombinedBehavior: signals.signals.signals2.combinedBehavior,
        resultErrorEvents: signals.signals.signals2.errorEvents,
        resultInvalidateEvent: signals.signals.signals2.invalidateEvent,
        resultPendingBehavior: signals.signals.signals2.pendingBehavior,
        resultTriggerEvent: signals.signals.signals2.triggerEvent,
      },
    }));

export default getValidatedInputWithResultSignalsFactory;
