import { Signals, SignalsFactory } from './signals-factory';
import { BehaviorId, EventId, getEventId, getStateId } from './store-utils';

/**
 * Type specifying the input signal ids produced by a {@link ModelSignalsFactory} (the corresponding signal-sources
 * are NOT added to the store by the signals-setup, but by whoever uses the signals, e.g. by extendSetup or fmap or just using dispatch).
 *
 * @template T - the type of the model to be handled
 */
export type ModelInputSignals<T> = {
  /** identifier for the event to replace the complete model */
  setModel: EventId<T>;

  /** identifier for the event to update the model by a given partial model */
  updateModel: EventId<Partial<T>>;

  /** identifier for the event to reset the model to the configured default */
  resetModel: EventId<undefined>;
};

/**
 * Type specifying the output signal ids produced by a {@link ModelSignalsFactory}.
 *
 * @template T - the type of the model to be handled
 */
export type ModelOutputSignals<T> = {
  /** identifier for the model behavior (on purpose no StateId to keep encapsulation, cause BehaviorId cannot be used to add more reducers) */
  model: BehaviorId<T>;
};

/**
 * Type specifying the configuration of a {@link ModelSignalsFactory}.
 *
 * @template T - the type of the model to be handled
 */
export type ModelConfig<T> = {
  /** the default model */
  defaultModel: T;

  /** optional string to be used as argument to calls of getBehaviorId and getEventId */
  nameExtension?: string;
};

const getModelSignals = <T>(
  config: ModelConfig<T>,
): Signals<ModelInputSignals<T>, ModelOutputSignals<T>> => {
  const model = getStateId<T>(`${config.nameExtension ?? ''}_model`);
  const setModel = getEventId<T>(`${config.nameExtension ?? ''}_setModel`);
  const updateModel = getEventId<Partial<T>>(`${config.nameExtension ?? ''}_updateModel`);
  const resetModel = getEventId<undefined>(`${config.nameExtension ?? ''}_resetModel`);
  return {
    input: {
      setModel,
      updateModel,
      resetModel,
    },
    output: {
      model,
    },
    effects: {},
    setup: store => {
      store.addState(model, config.defaultModel);
      store.addReducer(model, setModel, (_, event) => event);
      store.addReducer(model, updateModel, (state, event) => ({
        ...state,
        ...event,
      }));
      store.addReducer(model, resetModel, () => config.defaultModel);
    },
  };
};

/**
 * This type specifies a generic {@link SignalsFactory} to handle arbitrary models.
 *
 * @template T - specifies the type of the model
 */
export type ModelSignalsFactory<T> = SignalsFactory<
  ModelInputSignals<T>,
  ModelOutputSignals<T>,
  ModelConfig<T>
>;

/**
 * This function creates a {@link ModelSignalsFactory}.
 *
 * @template T - specifies the type of the model
 * @returns {ModelSignalsFactory<T>}
 */
export const getModelSignalsFactory = <T>(): ModelSignalsFactory<T> =>
  new SignalsFactory<ModelInputSignals<T>, ModelOutputSignals<T>, ModelConfig<T>>(getModelSignals);
