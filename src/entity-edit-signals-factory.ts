import { combineLatest, map } from 'rxjs';
import {
  CombinedEffectResult,
  EffectOutputSignals,
  getEffectSignalsFactory,
} from './effect-signals-factory';
import { ModelInputSignals, getModelSignalsFactory } from './model-signals-factory';
import { SignalsFactory } from './signals-factory';
import { DerivedId, EffectId, EventId, getDerivedId, isNotNoValueType } from './store-utils';
import { ModelValidationResult, isValidModelValidationResult } from './type-utils';
import {
  ValidatedInputWithResult,
  ValidatedInputWithResultOutput,
  getValidatedInputWithResultSignalsFactory,
} from './validated-input-with-result-signals-factory';

const isStringRecord = (value: any): value is Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value);

/**
 * A shallow equals function that performs shallow equals on records or arrays
 * and else falls back to strict equals.
 */
export const shallowEquals = <T>(a: T, b: T): boolean => {
  if (a === b) {
    return true;
  }
  if (isStringRecord(a) && isStringRecord(b)) {
    return (Object.entries(a).find(([k, v]) => v !== b[k]) ?? null) === null;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; ++i) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    return true;
  }
  return a === b;
};

/**
 * Value-type for the derived model behavior produced by {@link EntityEditFactory} Signals.
 *
 * @template Entity - specifies the entity type
 * @template IdType - specifies the entity-id-type
 * @template ValidationErrorType - specifies the error-type for failed validations
 */
export type EntityEditModel<Entity, IdType, ValidationErrorType> = {
  /**
   * The {@link CombinedEffectResult} for the load effect
   */
  load: CombinedEffectResult<IdType | null, Entity>;

  /**
   * The {@link ValidatedInputWithResult} for validation and result effects
   */
  edit: ValidatedInputWithResult<
    Entity,
    ModelValidationResult<Entity, ValidationErrorType>,
    IdType
  >;

  /**
   * The current Entity state
   */
  entity: Entity;

  /**
   * Convenience property for the current {@link ModelValidationResult}, taken from the edit property.
   */
  validation: ModelValidationResult<Entity, ValidationErrorType>;

  /**
   * true, if either:
   * the load effect is pending, or
   * the result effect is pending
   */
  loading: boolean;

  /**
   * true, if either:
   * the load effect is pending, or
   * the result effect is pending, or
   * the validation effect is pending, or
   * edit.isValid is false (the current validation result represents invalid entity state)
   */
  disabled: boolean;

  /**
   * true, if the entity does not equal the default entity, with respect to configured
   * equals function (defaults to {@link shallowEquals}).
   */
  changed: boolean;
};

/**
 * Type specifying the input signals for entity edit signals, hence a combination of
 * {@link ModelInputSignals}, an id-behavior (load) and a save event.
 */
export type EntityEditInput<Entity, IdType> = ModelInputSignals<Entity> & {
  /** input for the load effect */
  load: DerivedId<IdType | null>;

  /** input for the save effect */
  save: EventId<undefined>;
};

/**
 * Type specifying the output signals for entity edit signals,
 */
export type EntityEditOutput<Entity, IdType, ValidationErrorType> = {
  /** {@link EffectOutputSignals} for the load effect */
  load: EffectOutputSignals<IdType | null, Entity>;

  /** {@link ValidatedInputWithResultOutput} for the validation and result effects */
  edit: ValidatedInputWithResultOutput<
    Entity,
    ModelValidationResult<Entity, ValidationErrorType>,
    IdType
  >;

  /** derived bahavior for the {@link EntityEditModel} */
  model: DerivedId<EntityEditModel<Entity, IdType, ValidationErrorType>>;
};

/**
 * Type specifying the configuration for {@link EntityEditFactory},
 */
export type EntityEditConfiguration<Entity> = {
  /** the initial default entity, hence the initial entity state before the load effect. */
  defaultEntity: Entity;

  /**
   * Used to determine if the current entity state differs from default.
   * Note that the default might differ from configured defaultEntity!
   * A successful load effect will set a new default, as well as dispatching
   * a setAsDefault event.
   * This funtion defaults to {@link shallowEquals}, if not specified.
   */
  entityEquals?: (a: Entity, b: Entity) => boolean;

  /** optional event id for an event that should be dispatched on all save completed events */
  onSaveCompletedEvent?: EventId<undefined>;

  /** specifies whether the load behavior should be subscribed eagerly (defaults to false) */
  eagerLoadSubscription?: boolean;
};

/**
 * Type specifying the effects for {@link EntityEditFactory},
 */
export type EntityEditEffects<Entity, IdType, ValidationErrorType> = {
  /** effect that takes entity id or null and returns a corresponding entity (which sets the default model) */
  load: EffectId<IdType | null, Entity>;

  /** effect that takes an entity and returns the corresponding {@link ModelValidationResult} */
  validation: EffectId<Entity, ModelValidationResult<Entity, ValidationErrorType>>;

  /** effect that takes an entity and returns the id of the persisted entity */
  save: EffectId<Entity, IdType>;
};

/**
 * This type specifies a {@link SignalsFactory} producing signals to load, edit and persist an entity.
 *
 * @template Entity - specifies the entity type
 * @template IdType - specifies the entity-id-type
 * @template ValidationErrorType - specifies the error-type for failed validations
 */
export type EntityEditFactory<Entity, IdType, ValidationErrorType> = SignalsFactory<
  EntityEditInput<Entity, IdType>,
  EntityEditOutput<Entity, IdType, ValidationErrorType>,
  EntityEditConfiguration<Entity>,
  EntityEditEffects<Entity, IdType, ValidationErrorType>
>;

/**
 * Generic function to create a specific {@link EntityEditFactory}.
 * CAVE: This factory is work in progress and unit tests are still missing!
 */
export const getEntityEditSignalsFactory = <
  Entity,
  IdType = number,
  ValidationErrorType = string,
>(): EntityEditFactory<Entity, IdType, ValidationErrorType> =>
  getEffectSignalsFactory<IdType | null, Entity>() // model-fetch (fetching the edit entity)
    .renameInputId('input', 'load')
    .compose(getModelSignalsFactory<Entity>()) // editing-model
    .connectObservable(
      (store, output) => store.getBehavior(output.result).pipe(map(result => result.result)),
      'setAsDefault',
      true,
    ) // connecting entity model-fetch-result to editing-model
    .compose(
      getValidatedInputWithResultSignalsFactory<
        Entity,
        ModelValidationResult<Entity, ValidationErrorType>,
        IdType
      >(),
    ) // model validation and save
    .connect('model', 'input', false) // connecting editing-model and vali-persist
    .addOutputId('combinedModel', () =>
      getDerivedId<EntityEditModel<Entity, IdType, ValidationErrorType>>(),
    )
    .mapConfig((config: EntityEditConfiguration<Entity>) => ({
      c1: {
        c1: {
          eagerInputSubscription: config.eagerLoadSubscription,
        },
        c2: {
          defaultModel: config.defaultEntity,
        },
      },
      c2: {
        isValidationResultValid: isValidModelValidationResult,
        withResultTrigger: true,
      },
      onSaveCompletedEvent: config.onSaveCompletedEvent,
      entityEquals: config.entityEquals,
    }))
    .extendSetup((store, _, output, config) => {
      store.addDerivedState(
        output.combinedModel,
        combineLatest([
          store.getBehavior(output.conflicts1.combined),
          store.getBehavior(output.conflicts2.combined),
          store.getBehavior(output.pending),
          store.getBehavior(output.modelWithDefault),
        ]).pipe(
          map(([load, edit, pending, modelWithDefault]) => ({
            load,
            edit,
            entity: modelWithDefault.model,
            validation: isNotNoValueType(edit.validationResult) ? edit.validationResult : null,
            loading: pending || edit.resultPending,
            disabled: pending || edit.resultPending || edit.validationPending || !edit.isValid,
            changed: config.entityEquals
              ? config.entityEquals(modelWithDefault.model, modelWithDefault.default)
              : shallowEquals(modelWithDefault.model, modelWithDefault.default),
          })),
        ),
      );
      if (config.onSaveCompletedEvent) {
        store.connectObservable(
          store.getEventStream(output.resultCompletedSuccesses).pipe(map(() => undefined)),
          config.onSaveCompletedEvent,
        );
      }
    })
    .mapInput(
      (ids): EntityEditInput<Entity, IdType> => ({
        load: ids.load,
        save: ids.resultTrigger,
        set: ids.set,
        setAsDefault: ids.setAsDefault,
        update: ids.update,
        updateDeep: ids.updateDeep,
        updateBy: ids.updateBy,
        reset: ids.reset,
      }),
    )
    .mapOutput(
      (ids): EntityEditOutput<Entity, IdType, ValidationErrorType> => ({
        load: {
          combined: ids.conflicts1.combined,
          result: ids.conflicts1.result,
          pending: ids.pending,
          successes: ids.successes,
          completedSuccesses: ids.completedSuccesses,
          errors: ids.errors,
        },
        edit: {
          combined: ids.conflicts2.combined,
          result: ids.conflicts2.result,
          validationSuccesses: ids.validationSuccesses,
          validationCompletedSuccesses: ids.validationCompletedSuccesses,
          validationErrors: ids.validationErrors,
          resultSuccesses: ids.resultSuccesses,
          resultCompletedSuccesses: ids.resultCompletedSuccesses,
          resultErrors: ids.resultErrors,
        },
        model: ids.combinedModel,
      }),
    )
    .mapEffects(
      (ids): EntityEditEffects<Entity, IdType, ValidationErrorType> => ({
        load: ids.id,
        validation: ids.validation,
        save: ids.result,
      }),
    );
