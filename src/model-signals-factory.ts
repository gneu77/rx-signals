import { Signals, SignalsFactory } from './signals-factory';
import { BehaviorId, EventId, getEventId, getStateId } from './store-utils';
import { DeepPartial } from './type-utils';

export type ModelUpdateFunction<T extends Record<string, any>> = (model: T) => T;

/**
 * Type specifying the input signal ids produced by a {@link ModelSignalsFactory} (the corresponding signal-sources
 * are NOT added to the store by the signals-setup, but by whoever uses the signals, e.g. by extendSetup or fmap or just using dispatch).
 *
 * @template T - the type of the model to be handled
 */
export type ModelInputSignals<T extends Record<string, any>> = {
  /** identifier for the event to replace the complete model */
  set: EventId<T>;

  /** identifier for the event to update the model by a given shallow-partial model */
  update: EventId<Partial<T>>;

  /** identifier for the event to update the model by a given deep-partial model */
  updateDeep: EventId<DeepPartial<T>>;

  /** identifier for the event to update the model by a given update function */
  updateBy: EventId<ModelUpdateFunction<T>>;

  /** identifier for the event to reset the model to the configured default */
  reset: EventId<undefined>;
};

/**
 * Type specifying the output signal ids produced by a {@link ModelSignalsFactory}.
 *
 * @template T - the type of the model to be handled
 */
export type ModelOutputSignals<T extends Record<string, any>> = {
  /** identifier for the model behavior (on purpose no StateId to keep encapsulation, cause BehaviorId cannot be used to add more reducers) */
  model: BehaviorId<T>;
};

/**
 * Type specifying the configuration of a {@link ModelSignalsFactory}.
 *
 * @template T - the type of the model to be handled
 */
export type ModelConfig<T extends Record<string, any>> = {
  /** the default model */
  defaultModel: T;

  /** optional string to be used as argument to calls of getBehaviorId and getEventId */
  nameExtension?: string;
};

const deepUpdate = <T extends Record<string, any>>(model: T, patch: DeepPartial<T>): T =>
  Object.entries(patch).reduce(
    (acc, [key, value]) => ({
      ...acc,
      [key]:
        value && typeof value === 'object' && !Array.isArray(value)
          ? deepUpdate(acc[key], value)
          : value,
    }),
    model,
  );

const getModelSignals = <T extends Record<string, any>>(
  config: ModelConfig<T>,
): Signals<ModelInputSignals<T>, ModelOutputSignals<T>> => {
  const model = getStateId<T>(`${config.nameExtension ?? ''}_model`);
  const setModel = getEventId<T>(`${config.nameExtension ?? ''}_set`);
  const update = getEventId<Partial<T>>(`${config.nameExtension ?? ''}_update`);
  const updateDeep = getEventId<DeepPartial<T>>(`${config.nameExtension ?? ''}_updateDeep`);
  const updateBy = getEventId<ModelUpdateFunction<T>>(`${config.nameExtension ?? ''}_updateBy`);
  const reset = getEventId<undefined>(`${config.nameExtension ?? ''}_reset`);
  return {
    input: {
      set: setModel,
      update,
      updateDeep,
      updateBy,
      reset,
    },
    output: {
      model,
    },
    effects: {},
    setup: store => {
      store.addState(model, config.defaultModel);
      store.addReducer(model, setModel, (_, event) => event);
      store.addReducer(model, update, (state, event) => ({
        ...state,
        ...event,
      }));
      store.addReducer(model, updateDeep, (state, event) => deepUpdate(state, event));
      store.addReducer(model, updateBy, (state, event) => event(state));
      store.addReducer(model, reset, () => config.defaultModel);
    },
  };
};

/**
 * This type specifies a generic {@link SignalsFactory} to handle arbitrary models.
 *
 * @template T - specifies the type of the model
 */
export type ModelSignalsFactory<T extends Record<string, any>> = SignalsFactory<
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
export const getModelSignalsFactory = <T extends Record<string, any>>(): ModelSignalsFactory<T> =>
  new SignalsFactory<ModelInputSignals<T>, ModelOutputSignals<T>, ModelConfig<T>>(getModelSignals);
