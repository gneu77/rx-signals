import { map } from 'rxjs';
import { Signals, SignalsFactory } from './signals-factory';
import { BehaviorId, EventId, getDerivedId, getEventId, getStateId } from './store-utils';
import { DeepPartial } from './type-utils';

/**
 * The event-value-type for the model updateBy event
 *
 * @template T - the type of the model to be handled
 */
export type ModelUpdateFunction<T> = (model: T) => T;

/**
 * The event-value-type for the model update event
 *
 * @template T - the type of the model to be handled
 */
export type ModelUpdateEventType<T> = [T] extends [Record<string, any>] ? Partial<T> : T;

/**
 * The event-value-type for the model updateDeep event
 *
 * @template T - the type of the model to be handled
 */
export type ModelUpdateDeepEventType<T> = [T] extends [Record<string, any>] ? DeepPartial<T> : T;

/**
 * Output value type for a {@link ModelSignalsFactory}.
 *
 * @template T - the type of the model to be handled
 */
export type ModelWithDefault<T> = {
  /** the current model */
  model: T;

  /** the default model (hence, either the initial default, or the last model given by the `setAsDefault` event) */
  default: T;
};

/**
 * Type specifying the input signal ids produced by a {@link ModelSignalsFactory}.
 *
 * @template T - the type of the model to be handled
 */
export type ModelInputSignals<T> = {
  /** identifier for the event to replace the complete model */
  set: EventId<T>;

  /** like set, but also setting the new model as new default */
  setAsDefault: EventId<T>;

  /** in case the model is a `Record<string, any>`, identifier for the event to update the model by a given shallow-partial model, else equals the set event  */
  update: EventId<ModelUpdateEventType<T>>;

  /** in case the model is a `Record<string, any>`, identifier for the event to update the model by a given deep-partial model, else equals the set event */
  updateDeep: EventId<ModelUpdateDeepEventType<T>>;

  /** identifier for the event to update the model by a given update function */
  updateBy: EventId<ModelUpdateFunction<T>>;

  /** identifier for the event to reset the model to the default state (configured or set by `setAsDefault`) */
  reset: EventId<undefined>;
};

/**
 * Type specifying the output signal ids produced by a {@link ModelSignalsFactory}.
 *
 * @template T - the type of the model to be handled
 */
export type ModelOutputSignals<T> = {
  /** identifier for the current model behavior */
  model: BehaviorId<T>;

  /** identifier for the behavior combining current model and default model (either the initial default, or the last model given by the `setAsDefault` event) */
  modelWithDefault: BehaviorId<ModelWithDefault<T>>;
};

/**
 * Type specifying the configuration of a {@link ModelSignalsFactory}.
 *
 * @template T - the type of the model to be handled
 */
export type ModelConfig<T> = {
  /** the default model */
  defaultModel: T;

  /** optional string to be used as argument to calls of `getBehaviorId` and `getEventId` */
  nameExtension?: string;
};

const isRecord = (value: any): value is Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value);

const deepUpdate = <T>(model: T, patch: ModelUpdateDeepEventType<T>): T =>
  isRecord(model) && isRecord(patch)
    ? Object.entries(patch).reduce(
        (acc, [key, value]) => ({
          ...acc,
          [key]: isRecord(acc?.[key]) ? deepUpdate(acc[key], value) : value,
        }),
        model,
      )
    : (patch as T);

const getModelSignals = <T>(
  config: ModelConfig<T>,
): Signals<ModelInputSignals<T>, ModelOutputSignals<T>> => {
  const model = getDerivedId<T>(`${config.nameExtension ?? ''}_model`);
  const modelWithDefault = getStateId<ModelWithDefault<T>>(
    `${config.nameExtension ?? ''}_modelWithDefault`,
  );
  const setModel = getEventId<T>(`${config.nameExtension ?? ''}_set`);
  const setAsDefault = getEventId<T>(`${config.nameExtension ?? ''}_setAsDefault`);
  const update = getEventId<ModelUpdateEventType<T>>(`${config.nameExtension ?? ''}_update`);
  const updateDeep = getEventId<ModelUpdateDeepEventType<T>>(
    `${config.nameExtension ?? ''}_updateDeep`,
  );
  const updateBy = getEventId<ModelUpdateFunction<T>>(`${config.nameExtension ?? ''}_updateBy`);
  const reset = getEventId<undefined>(`${config.nameExtension ?? ''}_reset`);
  return {
    input: {
      set: setModel,
      setAsDefault,
      update,
      updateDeep,
      updateBy,
      reset,
    },
    output: {
      model,
      modelWithDefault,
    },
    effects: {},
    setup: store => {
      store.addState(modelWithDefault, {
        model: config.defaultModel,
        default: config.defaultModel,
      });
      store.addReducer(modelWithDefault, setModel, (state, event) => ({
        ...state,
        model: event,
      }));
      store.addReducer(modelWithDefault, setAsDefault, (_, event) => ({
        default: event,
        model: event,
      }));
      store.addReducer(modelWithDefault, update, (state, event) =>
        isRecord(state) && isRecord(event)
          ? {
              ...state,
              model: {
                ...state.model,
                ...event,
              },
            }
          : {
              ...state,
              model: event as T,
            },
      );
      store.addReducer(modelWithDefault, updateDeep, (state, event) =>
        isRecord(state) && isRecord(event)
          ? {
              ...state,
              model: deepUpdate(state.model, event),
            }
          : {
              ...state,
              model: event as T,
            },
      );
      store.addReducer(modelWithDefault, updateBy, (state, event) => ({
        ...state,
        model: event(state.model),
      }));
      store.addReducer(modelWithDefault, reset, state => ({
        ...state,
        model: state.default,
      }));
      store.addDerivedState(model, store.getBehavior(modelWithDefault).pipe(map(m => m.model)));
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
