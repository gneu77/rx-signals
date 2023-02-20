import { combineLatest, distinctUntilChanged, map, startWith } from 'rxjs';
import { filter, switchMap, take } from 'rxjs/operators';
import {
  CombinedEffectResult,
  EffectOutputSignals,
  getEffectSignalsFactory,
} from './effect-signals-factory';
import {
  ModelInputSignals,
  ModelWithDefault,
  getModelSignalsFactory,
} from './model-signals-factory';
import { SignalsFactory } from './signals-factory';
import {
  DerivedId,
  EffectId,
  EventId,
  NO_VALUE,
  getDerivedId,
  getEffectId,
  isNotNoValueType,
} from './store-utils';
import { ModelValidationResult, isValidModelValidationResult } from './type-utils';
import {
  ValidatedInputWithResult,
  ValidatedInputWithResultOutput,
  getValidatedInputWithResultSignalsFactory,
} from './validated-input-with-result-signals-factory';

const isRecord = (value: any): value is Record<any, any> =>
  value && typeof value === 'object' && !Array.isArray(value);

/**
 * A shallow equals function that performs shallow equals on records or arrays
 * and else falls back to strict equals.
 */
export const shallowEquals = <T>(a: T, b: T): boolean => {
  if (a === b) {
    return true;
  }
  if (isRecord(a) && isRecord(b)) {
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
 * @template LoadInput - specifies the input-type for the loading-effect will be `LoadInput | null` (defaults to number)
 * @template SaveOutput - specifies the output-type for the save-effect (defaults to LoadInput)
 * @template ValidationErrorType - specifies the error-type for failed validations
 */
export type EntityEditModel<
  Entity,
  LoadInput = number,
  SaveOutput = LoadInput,
  ValidationErrorType = string,
> = {
  /**
   * The {@link CombinedEffectResult} for the load effect
   */
  load: CombinedEffectResult<LoadInput | null, Entity>;

  /**
   * The {@link ValidatedInputWithResult} for validation and result effects
   */
  edit: ValidatedInputWithResult<
    ModelWithDefault<Entity>,
    ModelValidationResult<Entity, ValidationErrorType>,
    SaveOutput
  >;

  /**
   * The current Entity state (matching edit.currentInput.model)
   * If you need to compare with the current default, use edit.currentInput instead.
   */
  entity: Entity;

  /**
   * Current {@link ModelValidationResult} for entity.
   * If entity === edit.validatedInput.model, this matches edit.validationResult, else it's null.
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
   * edit.isValid is false (the current validation result represents invalid entity state), or
   * the result-input equals the current-input
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
export type EntityEditInput<Entity, LoadInput = number> = ModelInputSignals<Entity> & {
  /** input for the load effect */
  load: DerivedId<LoadInput | null>;

  /** trigger the load effect again, if a model for the current input id was already loaded */
  reload: EventId<undefined>;

  /** input for the save effect */
  save: EventId<undefined>;
};

/**
 * Type specifying the output signals for entity edit signals,
 */
export type EntityEditOutput<
  Entity,
  LoadInput = number,
  SaveOutput = LoadInput,
  ValidationErrorType = string,
> = {
  /** {@link EffectOutputSignals} for the load effect */
  load: EffectOutputSignals<LoadInput | null, Entity>;

  /** {@link ValidatedInputWithResultOutput} for the validation and result effects */
  edit: ValidatedInputWithResultOutput<
    ModelWithDefault<Entity>,
    ModelValidationResult<Entity, ValidationErrorType>,
    SaveOutput
  >;

  /** derived bahavior for the {@link EntityEditModel} */
  model: DerivedId<EntityEditModel<Entity, LoadInput, SaveOutput, ValidationErrorType>>;
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

  /** if specified with a value `>0`, this will be used as debounce-time for the validation-effect */
  validationEffectDebounceTime?: number;
};

/**
 * Type specifying the effects for {@link EntityEditFactory},
 */
export type EntityEditEffects<
  Entity,
  LoadInput = number,
  SaveOutput = LoadInput,
  ValidationErrorType = string,
> = {
  /** effect that takes an entity-id or null and returns a corresponding entity (which sets the default model) */
  load: EffectId<LoadInput | null, Entity>;

  /** effect that takes a {@link ModelWithDefault} for the entity and returns the corresponding {@link ModelValidationResult} */
  validation: EffectId<
    ModelWithDefault<Entity>,
    ModelValidationResult<Entity, ValidationErrorType>
  >;

  /** effect that takes an entity and returns the id of the persisted entity */
  save: EffectId<Entity, SaveOutput>;
};

/**
 * This type specifies a {@link SignalsFactory} producing signals to load, edit and persist an entity.
 *
 * @template Entity - specifies the entity type
 * @template LoadInput - specifies the input-type for the loading-effect will be `LoadInput | null` (defaults to number)
 * @template SaveOutput - specifies the output-type for the save-effect (defaults to LoadInput)
 * @template ValidationErrorType - specifies the error-type for failed validations
 */
export type EntityEditFactory<
  Entity,
  LoadInput = number,
  SaveOutput = LoadInput,
  ValidationErrorType = string,
> = SignalsFactory<
  EntityEditInput<Entity, LoadInput>,
  EntityEditOutput<Entity, LoadInput, SaveOutput, ValidationErrorType>,
  EntityEditConfiguration<Entity>,
  EntityEditEffects<Entity, LoadInput, SaveOutput, ValidationErrorType>
>;

/**
 * Generic function to create a specific {@link EntityEditFactory}.
 * This is another example for factory composition, composing
 * (a) EffectSignalsFactory for entity loading
 * (b) ModelSignalsFactory for entity changing
 * (c) ValidatedInputWithResultSignalsFactory for validation and persiting
 *
 * @template Entity - specifies the entity type
 * @template LoadInput - specifies the input-type for the loading-effect will be `LoadInput | null` (defaults to number)
 * @template SaveOutput - specifies the output-type for the save-effect (defaults to LoadInput)
 * @template ValidationErrorType - specifies the error-type for failed validations
 */
export const getEntityEditSignalsFactory = <
  Entity,
  LoadInput = number,
  SaveOutput = LoadInput,
  ValidationErrorType = string,
>(): EntityEditFactory<Entity, LoadInput, SaveOutput, ValidationErrorType> =>
  getEffectSignalsFactory<LoadInput | null, Entity>() // model-fetch (fetching the edit entity)
    .renameInputId('input', 'load')
    .compose(getModelSignalsFactory<Entity>()) // editing-model
    .connectObservable(
      (store, output) => store.getBehavior(output.result).pipe(map(result => result.result)),
      'setAsDefault',
      true,
    ) // connecting entity model-fetch-result to editing-model
    .compose(
      getValidatedInputWithResultSignalsFactory<
        ModelWithDefault<Entity>,
        ModelValidationResult<Entity, ValidationErrorType>,
        SaveOutput
      >(),
    ) // model validation and save
    .connect('modelWithDefault', 'input', false) // connecting editing-model and vali-persist-input
    .addOutputId('combinedModel', () =>
      getDerivedId<EntityEditModel<Entity, LoadInput, SaveOutput, ValidationErrorType>>(),
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
        validationEffectDebounceTime: config.validationEffectDebounceTime,
      },
      onSaveCompletedEvent: config.onSaveCompletedEvent,
      entityEquals: config.entityEquals,
    }))
    .addEffectId('save', () => getEffectId<Entity, SaveOutput>())
    .extendSetup((store, _, output, config, effects) => {
      store.addEffect(effects.result, (modelWithResult, st, prevInput, prevResult) =>
        st.getEffect(effects.save).pipe(
          take(1), // without this, the effect would never complete
          switchMap(eff =>
            eff(
              modelWithResult.model,
              st,
              isNotNoValueType(prevInput) ? prevInput.model : NO_VALUE,
              prevResult,
            ),
          ),
        ),
      );
      store.addDerivedState(
        output.combinedModel,
        combineLatest([
          combineLatest([
            store.getBehavior(output.conflicts1.combined).pipe(
              startWith({
                currentInput: NO_VALUE,
                resultPending: false,
                resultInput: NO_VALUE,
                result: NO_VALUE,
              }),
            ),
            store.getBehavior(output.conflicts2.combined),
          ]).pipe(
            map(
              ([load, edit]): [
                CombinedEffectResult<LoadInput | null, Entity>,
                ValidatedInputWithResult<
                  ModelWithDefault<Entity>,
                  ModelValidationResult<Entity, ValidationErrorType>,
                  SaveOutput
                >,
                boolean,
                boolean,
                ModelValidationResult<Entity, ValidationErrorType>,
              ] => [
                load,
                edit,
                load.resultPending || edit.resultPending,
                load.resultPending ||
                  edit.resultPending ||
                  edit.validationPending ||
                  !edit.isValid ||
                  (isNotNoValueType(edit.resultInput) &&
                    isNotNoValueType(edit.currentInput) &&
                    (config.entityEquals
                      ? config.entityEquals(edit.resultInput.model, edit.currentInput.model)
                      : shallowEquals(edit.resultInput.model, edit.currentInput.model))),
                edit.currentInput === edit.validatedInput && isNotNoValueType(edit.validationResult)
                  ? edit.validationResult
                  : null,
              ],
            ),
            distinctUntilChanged(
              (
                [aload, aedit, aloading, adisabled, avalidation],
                [bload, bedit, bloading, bdisabled, bvalidation],
              ) =>
                aloading === bloading &&
                adisabled === bdisabled &&
                shallowEquals(aload, bload) &&
                shallowEquals(aedit, bedit) &&
                shallowEquals(avalidation, bvalidation),
            ),
          ),
          store
            .getBehavior(output.modelWithDefault)
            .pipe(
              map((modelWithDefault): [Entity, boolean] => [
                modelWithDefault.model,
                config.entityEquals
                  ? !config.entityEquals(modelWithDefault.model, modelWithDefault.default)
                  : !shallowEquals(modelWithDefault.model, modelWithDefault.default),
              ]),
            ),
        ]).pipe(
          filter(
            ([[, edit], [entity]]) =>
              isNotNoValueType(edit.currentInput) && edit.currentInput.model === entity,
          ),
          map(([[load, edit, loading, disabled, validation], [entity, changed]]) => ({
            load,
            edit,
            entity,
            validation,
            loading,
            disabled,
            changed,
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
      (ids): EntityEditInput<Entity, LoadInput> => ({
        load: ids.load,
        reload: ids.invalidate,
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
      (ids): EntityEditOutput<Entity, LoadInput, SaveOutput, ValidationErrorType> => ({
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
      (ids): EntityEditEffects<Entity, LoadInput, SaveOutput, ValidationErrorType> => ({
        load: ids.id,
        validation: ids.validation,
        save: ids.save,
      }),
    );
