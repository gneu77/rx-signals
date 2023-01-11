import { distinctUntilChanged, filter, map, share } from 'rxjs';
import { Signals, SignalsFactory } from './signals-factory';
import { Store } from './store';
import { DerivedId, EventId, getDerivedId, getEventId, getStateId } from './store-utils';

export const TRIGGER_NO_VALUE = '$INTERNAL_TRIGGER_NO_VALUE$';

export type TriggerNoValueType = typeof TRIGGER_NO_VALUE;

type TriggerState<T> = {
  currentInput: T | TriggerNoValueType;
  triggeredInput: {
    value: T | TriggerNoValueType;
  };
  changedAfterTrigger: boolean;
};

const isNotTriggerNoValueType = <T>(
  v: T | TriggerNoValueType,
): v is Exclude<T, TriggerNoValueType> => v !== TRIGGER_NO_VALUE;

/**
 * Type specifying the input {@link TriggerSignals} (the corresponding signal-sources are NOT added to the store
 * by the TriggerSignals-setup, but by whoever uses the signals, e.g. by extendSetup or fmap or just using dispatch).
 *
 * @template T - specifies the value type for the triggered signal
 */
export type TriggerInputSignals<T> = {
  /** Behavior representing the input signal */
  triggerInput: DerivedId<T>;

  /** Event that triggers the current input as output */
  trigger: EventId<undefined>;
};

/**
 * Type specifying the output {@link TriggerSignals} (signals produced by TriggerSignals).
 *
 * @template T - specifies the value type for the triggered signal
 */
export type TriggerOutputSignals<T> = {
  /**
   * Behavior representing the triggered output signal.
   * Triggering the same input multiple times will NOT lead to multiple outputs (all behaviors are distinctUntilChanged).
   * You can instead use the triggered event, if you need to take action on each trigger event.
   */
  triggeredOutput: DerivedId<T>;

  /**
   * Event with the triggered output.
   * In contrast to triggeredOutput, triggering the same input multiple times will lead to the same number of triggered events.
   */
  triggered: EventId<T>;
};

/**
 * This type specifies input and output signals of a triggerable behavior.
 *
 * @template T - specifies the value type for the triggered signal
 */
export type TriggerSignals<T> = Signals<TriggerInputSignals<T>, TriggerOutputSignals<T>>;

/**
 * This type specifies the type of the argument to {@link TriggerSignalsBuild}, hence the configuration of {@link TriggerSignals}.
 */
export type TriggerConfiguration = {
  /** Optional string to be used as argument to calls of getBehaviorId and getEventId */
  nameExtension?: string;
};

/**
 * Type specifying the {@link SignalsBuild} function for {@link TriggerSignals}, hence a function taking an {@link TriggerConfiguration} and producing TriggerSignals.
 *
 * @template T - specifies the value type for the triggered signal
 * @param {TriggerConfiguration} config - the configuration for the TriggerSignals
 */
export type TriggerSignalsBuild = <T>(config: TriggerConfiguration) => TriggerSignals<T>;

const getInputSignalIds = <T>(nameExtension?: string): TriggerInputSignals<T> => ({
  triggerInput: getDerivedId<T>(`${nameExtension ?? ''}_triggerInput`),
  trigger: getEventId<undefined>(`${nameExtension ?? ''}_trigger`),
});

const getOutputSignalIds = <T>(nameExtension?: string): TriggerOutputSignals<T> => ({
  triggeredOutput: getDerivedId<T>(`${nameExtension ?? ''}_triggeredOutput`),
  triggered: getEventId<T>(`${nameExtension ?? ''}_triggered`),
});

const getTriggerBuilder: TriggerSignalsBuild = <T>(
  config: TriggerConfiguration,
): TriggerSignals<T> => {
  const inIds = getInputSignalIds<T>(config.nameExtension);
  const outIds = getOutputSignalIds<T>(config.nameExtension);
  const setup = (store: Store) => {
    const internalState = getStateId<TriggerState<T>>();
    const newInput = getEventId<T>();
    store.connect(inIds.triggerInput, newInput);
    store.addState(internalState, {
      currentInput: TRIGGER_NO_VALUE,
      triggeredInput: {
        value: TRIGGER_NO_VALUE,
      },
      changedAfterTrigger: false,
    });
    store.addReducer(internalState, newInput, (state, currentInput) => ({
      currentInput,
      triggeredInput: {
        value: state.triggeredInput.value,
      },
      changedAfterTrigger: true,
    }));
    store.addReducer(internalState, inIds.trigger, state => ({
      currentInput: state.currentInput,
      triggeredInput: {
        value: state.currentInput,
      },
      changedAfterTrigger: false,
    }));

    const sharedObs = store.getBehavior(internalState).pipe(
      filter(s => !s.changedAfterTrigger && s.currentInput === s.triggeredInput.value),
      map(s => s.triggeredInput.value),
      filter(isNotTriggerNoValueType),
      share(),
    );
    store.addDerivedState(outIds.triggeredOutput, sharedObs.pipe(distinctUntilChanged()));
    store.addEventSource(outIds.triggered, sharedObs);
  };
  return {
    setup,
    input: inIds,
    output: outIds,
    effects: {},
  };
};

/**
 * This type specifies a {@link SignalsFactory} wrapping {@link TriggerSignals}.
 *
 * @template T - specifies the value type for the triggered signal
 */
export type TriggerSignalsFactory<T> = SignalsFactory<
  TriggerInputSignals<T>,
  TriggerOutputSignals<T>,
  TriggerConfiguration
>;

/**
 * This function creates a {@link TriggerSignalsFactory}.
 *
 * @template T - specifies the value type for the triggered signal
 * @returns {TriggerSignalsFactory<T>}
 */
export const getTriggerSignalsFactory = <T>(): TriggerSignalsFactory<T> =>
  new SignalsFactory<TriggerInputSignals<T>, TriggerOutputSignals<T>, TriggerConfiguration>(
    getTriggerBuilder,
  );
