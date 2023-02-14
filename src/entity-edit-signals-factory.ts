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

export type EntityEditModel<Entity, IdType, ValidationErrorType> = {
  load: CombinedEffectResult<IdType | null, Entity>;
  edit: ValidatedInputWithResult<
    Entity,
    ModelValidationResult<Entity, ValidationErrorType>,
    IdType
  >;
  model: Entity | undefined;
  validation: ModelValidationResult<Entity, ValidationErrorType>;
  loading: boolean;
  disabled: boolean;
  changed: boolean;
};

export type EntityEditInput<Entity, IdType> = ModelInputSignals<Entity> & {
  load: DerivedId<IdType | null>;
  save: EventId<undefined>;
};

export type EntityEditOutput<Entity, IdType, ValidationErrorType> = {
  load: EffectOutputSignals<IdType | null, Entity>;
  edit: ValidatedInputWithResultOutput<
    Entity,
    ModelValidationResult<Entity, ValidationErrorType>,
    IdType
  >;
  model: DerivedId<EntityEditModel<Entity, IdType, ValidationErrorType>>;
};

export type EntityEditConfiguration<Entity> = {
  defaultEntity: Entity;
  onSaveSuccessEvent?: EventId<undefined>;
  eagerLoadSubscription?: boolean;
};

export type EntityEditEffects<Entity, IdType, ValidationErrorType> = {
  load: EffectId<IdType | null, Entity>;
  validation: EffectId<Entity, ModelValidationResult<Entity, ValidationErrorType>>;
  result: EffectId<Entity, IdType>;
};

export type EntityEditFactory<Entity, IdType, ValidationErrorType> = SignalsFactory<
  EntityEditInput<Entity, IdType>,
  EntityEditOutput<Entity, IdType, ValidationErrorType>,
  EntityEditConfiguration<Entity>,
  EntityEditEffects<Entity, IdType, ValidationErrorType>
>;

/**
 * Generic function to create a specific {@link EntityEditFactory}.
 * CAVE: This factory is work in progress and unit tests, as well as documentation is still missing!
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
      onSaveSuccessEvent: config.onSaveSuccessEvent,
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
            model: modelWithDefault.model,
            validation: isNotNoValueType(edit.validationResult) ? edit.validationResult : null,
            loading: pending || edit.resultPending,
            disabled: pending || edit.resultPending || edit.validationPending || !edit.isValid,
            changed: modelWithDefault.model !== modelWithDefault.default,
          })),
        ),
      );
      if (config.onSaveSuccessEvent) {
        console.log('connecting');
        store.connectObservable(
          store.getEventStream(output.resultSuccesses).pipe(map(() => undefined)),
          config.onSaveSuccessEvent,
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
          errors: ids.errors,
        },
        edit: {
          combined: ids.conflicts2.combined,
          result: ids.conflicts2.result,
          validationSuccesses: ids.validationSuccesses,
          validationErrors: ids.validationErrors,
          resultSuccesses: ids.resultSuccesses,
          resultErrors: ids.resultErrors,
        },
        model: ids.combinedModel,
      }),
    )
    .mapEffects(
      (ids): EntityEditEffects<Entity, IdType, ValidationErrorType> => ({
        load: ids.id,
        validation: ids.validation,
        result: ids.result,
      }),
    );
