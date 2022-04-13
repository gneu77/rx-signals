import { Signals, SignalsFactory } from './signals-factory';
import { BehaviorId, EventId, getBehaviorId, getEventId } from './store-utils';

/**
 * Type specifying the input signal ids produced by a ModelSignalsFactory (the corresponding signal-sources
 * are NOT added to the store by the signals-setup, but by whoever uses the signals, e.g. by extendSetup or fmap or just using dispatch).
 *
 * @typedef {object} ModelInputSignals<T> - object holding the input signal identifiers for ModelSignals
 * @template T - the type of the model to be handled
 * @property {EventId<T>} setModel - identifier for the event to replace the complete model
 * @property {EventId<Partial<T>>} updateModel - identifier for the event to update the model by a given partial model
 * @property {EventId<void>} resetModel - identifier for the event to reset the model to the configured default
 */
export type ModelInputSignals<T> = {
  setModel: EventId<T>;
  updateModel: EventId<Partial<T>>;
  resetModel: EventId<void>;
};

/**
 * Type specifying the output signal ids produced by a ModelSignalsFactory.
 *
 * @typedef {object} ModelOutputSignals<T> - object holding the output signal identifiers for ModelSignals
 * @template T - the type of the model to be handled
 * @property {BehaviorId<T>} model - identifier for the model behavior
 */
export type ModelOutputSignals<T> = {
  model: BehaviorId<T>;
};

/**
 * Type specifying the configuration of a ModelSignalsFactory.
 *
 * @typedef {object} ModelConfig<T> - object holding the configuration for ModelSignals
 * @template T - the type of the model to be handled
 * @property {T} defaultModel - the default model
 * @property {string | undefined} nameExtension - optional string to be used as argument to calls of getBehaviorId and getEventId
 */
export type ModelConfig<T> = {
  defaultModel: T;
  nameExtension?: string;
};

const getModelSignals = <T>(
  config: ModelConfig<T>,
): Signals<ModelInputSignals<T>, ModelOutputSignals<T>> => {
  const model = getBehaviorId<T>(`${config.nameExtension ?? ''}_model`);
  const setModel = getEventId<T>(`${config.nameExtension ?? ''}_setModel`);
  const updateModel = getEventId<Partial<T>>(`${config.nameExtension ?? ''}_updateModel`);
  const resetModel = getEventId<void>(`${config.nameExtension ?? ''}_resetModel`);
  return {
    input: {
      setModel,
      updateModel,
      resetModel,
    },
    output: {
      model,
    },
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
 * This type specifies a generic SignalsFactory to handle arbitrary models.
 *
 * @typedef {object} ModelSignalsFactory<T>
 * @template T - specifies the type of the model
 */
export type ModelSignalsFactory<T> = SignalsFactory<
  ModelInputSignals<T>,
  ModelOutputSignals<T>,
  ModelConfig<T>
>;

/**
 * This function creates a ModelSignalsFactory<T>.
 *
 * @template T - specifies the type of the model
 * @returns {ModelSignalsFactory<T>}
 */
export const getModelSignalsFactory = <T>(): ModelSignalsFactory<T> =>
  new SignalsFactory<ModelInputSignals<T>, ModelOutputSignals<T>, ModelConfig<T>>(getModelSignals);
