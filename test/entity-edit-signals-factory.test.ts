import { Subject, distinctUntilChanged, filter, of, startWith } from 'rxjs';
import { delay, map, switchMap } from 'rxjs/operators';
import { getLens } from '../src/optional-lens';
import { Effect, Store } from '../src/store';
import { NO_VALUE } from '../src/store-utils';
import { expectSequence } from '../src/test-utils/test-utils';
import { isNotEffectError } from './../src/effect-result';
import {
  EntityEditEffects,
  EntityEditInput,
  EntityEditOutput,
  getEntityEditSignalsFactory,
  shallowEquals,
} from './../src/entity-edit-signals-factory';
import { ModelWithDefault } from './../src/model-signals-factory';
import { NoValueType } from './../src/store-utils';
import { ModelValidationResult, patchModelValidationResult } from './../src/type-utils';

type MyEntity = {
  id: number;
  b: string;
  d: number[];
};

const defaultEntity = {
  id: 42,
  b: 'test',
  d: [1, 2, 3],
};

describe('EntityEditSignalsFactory', () => {
  const baseFactory = getEntityEditSignalsFactory<MyEntity>();
  let store: Store;
  let inputSignals: EntityEditInput<MyEntity>;
  let outputSignals: EntityEditOutput<MyEntity>;
  let effects: EntityEditEffects<MyEntity>;
  const inputSubject = new Subject<number | null>();

  beforeEach(() => {
    store = new Store();
  });

  describe('basic usage', () => {
    beforeEach(() => {
      const signals = baseFactory.build({
        defaultEntity,
      });
      signals.setup(store);
      inputSignals = signals.input;
      outputSignals = signals.output;
      effects = signals.effects;
      store.connectObservable(inputSubject, inputSignals.load);
    });

    describe('without added effects', () => {
      it('should give load behavior', async () => {
        const sequence = expectSequence(store.getBehavior(outputSignals.load.combined), [
          {
            currentInput: 42,
            resultPending: true,
            resultInput: NO_VALUE,
            result: NO_VALUE,
          },
        ]);
        inputSubject.next(42);
        await sequence;
      });

      it('should give edit behavior and handle update', async () => {
        const sequence = expectSequence(store.getBehavior(outputSignals.edit.combined), [
          {
            currentInput: {
              default: defaultEntity,
              model: defaultEntity,
            },
            validationPending: true,
            isValid: false,
            validatedInput: NO_VALUE,
            validationResult: NO_VALUE,
            resultPending: false,
            resultInput: NO_VALUE,
            result: NO_VALUE,
          },
          {
            currentInput: {
              default: defaultEntity,
              model: { ...defaultEntity, id: 5 },
            },
            validationPending: true,
            isValid: false,
            validatedInput: NO_VALUE,
            validationResult: NO_VALUE,
            resultPending: false,
            resultInput: NO_VALUE,
            result: NO_VALUE,
          },
        ]);
        store.dispatch(inputSignals.update, { id: 5 });
        await sequence;
      });

      it('should give a model behavior', async () => {
        const sequence = expectSequence(store.getBehavior(outputSignals.model), [
          {
            load: {
              currentInput: NO_VALUE,
              resultPending: false,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            edit: {
              currentInput: {
                default: defaultEntity,
                model: defaultEntity,
              },
              validationPending: true,
              isValid: false,
              validatedInput: NO_VALUE,
              validationResult: NO_VALUE,
              resultPending: false,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            entity: defaultEntity,
            validation: NO_VALUE,
            loading: false,
            disabled: true,
            changed: false,
          },
        ]);
        await sequence;
      });

      it('should update model behavior', async () => {
        const expectedEntity = {
          ...defaultEntity,
          d: [7],
        };
        const sequence = expectSequence(store.getBehavior(outputSignals.model), [
          {
            load: {
              currentInput: NO_VALUE,
              resultPending: false,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            edit: {
              currentInput: {
                default: defaultEntity,
                model: defaultEntity,
              },
              validationPending: true,
              isValid: false,
              validatedInput: NO_VALUE,
              validationResult: NO_VALUE,
              resultPending: false,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            entity: defaultEntity,
            validation: NO_VALUE,
            loading: false,
            disabled: true,
            changed: false,
          },
          {
            load: {
              currentInput: NO_VALUE,
              resultPending: false,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            edit: {
              currentInput: {
                default: defaultEntity,
                model: expectedEntity,
              },
              validationPending: true,
              isValid: false,
              validatedInput: NO_VALUE,
              validationResult: NO_VALUE,
              resultPending: false,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            entity: expectedEntity,
            validation: NO_VALUE,
            loading: false,
            disabled: true,
            changed: true,
          },
        ]);
        store.dispatch(inputSignals.updateDeep, { d: [7] });
        await sequence;
      });
    });

    describe('with effects', () => {
      const validationLens = getLens<ModelValidationResult<MyEntity>>().k('b');
      const modelLens = getLens<NoValueType | ModelWithDefault<MyEntity>>().k('model').k('b');
      const loadEffect: Effect<number | null, MyEntity, string> = (id: number | null) => {
        return of(
          id === null
            ? defaultEntity
            : {
                id,
                b: 'loaded',
                d: [id],
              },
        ).pipe(delay(50));
      };

      const validationEffect: Effect<
        ModelWithDefault<MyEntity>,
        ModelValidationResult<MyEntity>,
        string
      > = (input: ModelWithDefault<MyEntity>, { previousInput, previousResult }) =>
        of<ModelValidationResult<MyEntity>>(
          input.model.d.length < 1 ? { d: 'min size 1' } : null,
        ).pipe(
          map(v => (!!input.model.b ? v : patchModelValidationResult(v, { b: 'mandatory' }))), // 'b' is mandatory
          switchMap(
            v =>
              (validationLens.get(v) ?? null) !== null // is 'b' already validated as being missing?
                ? of(v) // 'b' is missing, so validation is finished (it cannot have unique violation)
                : modelLens.get(previousInput) === input.model.b && isNotEffectError(previousResult) // is current 'b' the same as in the previous input?
                ? of(patchModelValidationResult(v, { b: validationLens.get(previousResult) })) // it's the same, so we can take it's previous validation result
                : of(
                    // it's not the same, so "we have to call our backend to validate uniqueness"
                    patchModelValidationResult(v, {
                      b: input.model.b === 'exists' ? 'exists' : null,
                    }),
                  ).pipe(delay(10), startWith(v)), // while the "backend call is running" (the delay), we already dispatch the validation so far
          ),
        );

      const saveEffect: Effect<MyEntity, number, string> = (input: MyEntity) => {
        return of(input.id).pipe(delay(10));
      };

      beforeEach(() => {
        store.addEffect(effects.load, loadEffect);
        store.addEffect(effects.validation, validationEffect);
        store.addEffect(effects.save, saveEffect);
      });

      it('should update model behavior', async () => {
        // CAVE: the sequence will change, if the load-effect is not slower than the validation-effect, so don't change the delays!
        const sequence = expectSequence(store.getBehavior(outputSignals.model), [
          {
            load: {
              currentInput: NO_VALUE,
              resultPending: false,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            edit: {
              currentInput: {
                default: defaultEntity,
                model: defaultEntity,
              },
              validationPending: true,
              isValid: false,
              validatedInput: NO_VALUE,
              validationResult: NO_VALUE,
              resultPending: false,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            entity: defaultEntity,
            validation: NO_VALUE,
            loading: false,
            disabled: true,
            changed: false,
          },
          {
            load: {
              currentInput: 3,
              resultPending: true,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            edit: {
              currentInput: {
                default: defaultEntity,
                model: defaultEntity,
              },
              validationPending: true,
              isValid: false,
              validatedInput: NO_VALUE,
              validationResult: NO_VALUE,
              resultPending: false,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            entity: defaultEntity,
            validation: NO_VALUE,
            loading: true,
            disabled: true,
            changed: false,
          },
          {
            load: {
              currentInput: 3,
              resultPending: true,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            edit: {
              currentInput: {
                default: defaultEntity,
                model: defaultEntity,
              },
              validationPending: true,
              isValid: false,
              validatedInput: {
                default: defaultEntity,
                model: defaultEntity,
              },
              validationResult: null,
              resultPending: false,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            entity: defaultEntity,
            validation: null,
            loading: true,
            disabled: true,
            changed: false,
          },
          {
            load: {
              currentInput: 3,
              resultPending: true,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            edit: {
              currentInput: {
                default: defaultEntity,
                model: defaultEntity,
              },
              validationPending: true,
              isValid: false,
              validatedInput: {
                default: defaultEntity,
                model: defaultEntity,
              },
              validationResult: { b: null },
              resultPending: false,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            entity: defaultEntity,
            validation: { b: null },
            loading: true,
            disabled: true,
            changed: false,
          },
          {
            load: {
              currentInput: 3,
              resultPending: true,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            edit: {
              currentInput: {
                default: defaultEntity,
                model: defaultEntity,
              },
              validationPending: false,
              isValid: true,
              validatedInput: {
                default: defaultEntity,
                model: defaultEntity,
              },
              validationResult: { b: null },
              resultPending: false,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            entity: defaultEntity,
            validation: { b: null },
            loading: true,
            disabled: true,
            changed: false,
          },
          {
            load: {
              currentInput: 3,
              resultPending: true,
              resultInput: 3,
              result: { id: 3, b: 'loaded', d: [3] },
            },
            edit: {
              currentInput: {
                default: defaultEntity,
                model: defaultEntity,
              },
              validationPending: false,
              isValid: true,
              validatedInput: {
                default: defaultEntity,
                model: defaultEntity,
              },
              validationResult: { b: null },
              resultPending: false,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            entity: defaultEntity,
            validation: { b: null },
            loading: true,
            disabled: true,
            changed: false,
          },
          {
            load: {
              currentInput: 3,
              resultPending: false,
              resultInput: 3,
              result: { id: 3, b: 'loaded', d: [3] },
            },
            edit: {
              currentInput: {
                default: defaultEntity,
                model: defaultEntity,
              },
              validationPending: false,
              isValid: true,
              validatedInput: {
                default: defaultEntity,
                model: defaultEntity,
              },
              validationResult: { b: null },
              resultPending: false,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            entity: defaultEntity,
            validation: { b: null },
            loading: false,
            disabled: false,
            changed: false,
          },
          {
            load: {
              currentInput: 3,
              resultPending: false,
              resultInput: 3,
              result: { id: 3, b: 'loaded', d: [3] },
            },
            edit: {
              currentInput: {
                default: { id: 3, b: 'loaded', d: [3] },
                model: { id: 3, b: 'loaded', d: [3] },
              },
              validationPending: true,
              isValid: false,
              validatedInput: {
                default: defaultEntity,
                model: defaultEntity,
              },
              validationResult: { b: null },
              resultPending: false,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            entity: { id: 3, b: 'loaded', d: [3] },
            validation: NO_VALUE,
            loading: false,
            disabled: true,
            changed: false,
          },
          {
            load: {
              currentInput: 3,
              resultPending: false,
              resultInput: 3,
              result: { id: 3, b: 'loaded', d: [3] },
            },
            edit: {
              currentInput: {
                default: { id: 3, b: 'loaded', d: [3] },
                model: { id: 3, b: 'loaded', d: [3] },
              },
              validationPending: true,
              isValid: false,
              validatedInput: {
                default: { id: 3, b: 'loaded', d: [3] },
                model: { id: 3, b: 'loaded', d: [3] },
              },
              validationResult: null,
              resultPending: false,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            entity: { id: 3, b: 'loaded', d: [3] },
            validation: null,
            loading: false,
            disabled: true,
            changed: false,
          },
          {
            load: {
              currentInput: 3,
              resultPending: false,
              resultInput: 3,
              result: { id: 3, b: 'loaded', d: [3] },
            },
            edit: {
              currentInput: {
                default: { id: 3, b: 'loaded', d: [3] },
                model: { id: 3, b: 'loaded', d: [3] },
              },
              validationPending: true,
              isValid: false,
              validatedInput: {
                default: { id: 3, b: 'loaded', d: [3] },
                model: { id: 3, b: 'loaded', d: [3] },
              },
              validationResult: { b: null },
              resultPending: false,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            entity: { id: 3, b: 'loaded', d: [3] },
            validation: { b: null },
            loading: false,
            disabled: true,
            changed: false,
          },
          {
            load: {
              currentInput: 3,
              resultPending: false,
              resultInput: 3,
              result: { id: 3, b: 'loaded', d: [3] },
            },
            edit: {
              currentInput: {
                default: { id: 3, b: 'loaded', d: [3] },
                model: { id: 3, b: 'loaded', d: [3] },
              },
              validationPending: false,
              isValid: true,
              validatedInput: {
                default: { id: 3, b: 'loaded', d: [3] },
                model: { id: 3, b: 'loaded', d: [3] },
              },
              validationResult: { b: null },
              resultPending: false,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            entity: { id: 3, b: 'loaded', d: [3] },
            validation: { b: null },
            loading: false,
            disabled: false,
            changed: false,
          },
        ]);
        inputSubject.next(3);
        await sequence;
      });

      it('should give correct two-phase validation', async () => {
        const sequence = expectSequence(
          store.getBehavior(outputSignals.model).pipe(
            map(m => m.edit),
            distinctUntilChanged(shallowEquals),
            filter(e => e.currentInput === e.validatedInput),
          ),
          [
            {
              currentInput: {
                default: defaultEntity,
                model: defaultEntity,
              },
              validationPending: true,
              isValid: false,
              validatedInput: {
                default: defaultEntity,
                model: defaultEntity,
              },
              validationResult: null,
              resultPending: false,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            {
              currentInput: {
                default: defaultEntity,
                model: defaultEntity,
              },
              validationPending: true,
              isValid: false,
              validatedInput: {
                default: defaultEntity,
                model: defaultEntity,
              },
              validationResult: { b: null },
              resultPending: false,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            {
              currentInput: {
                default: defaultEntity,
                model: defaultEntity,
              },
              validationPending: false,
              isValid: true,
              validatedInput: {
                default: defaultEntity,
                model: defaultEntity,
              },
              validationResult: { b: null },
              resultPending: false,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            {
              currentInput: {
                default: { id: 3, b: 'loaded', d: [3] },
                model: { id: 3, b: 'loaded', d: [3] },
              },
              validationPending: true,
              isValid: false,
              validatedInput: {
                default: { id: 3, b: 'loaded', d: [3] },
                model: { id: 3, b: 'loaded', d: [3] },
              },
              validationResult: null,
              resultPending: false,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            {
              currentInput: {
                default: { id: 3, b: 'loaded', d: [3] },
                model: { id: 3, b: 'loaded', d: [3] },
              },
              validationPending: true,
              isValid: false,
              validatedInput: {
                default: { id: 3, b: 'loaded', d: [3] },
                model: { id: 3, b: 'loaded', d: [3] },
              },
              validationResult: { b: null },
              resultPending: false,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            {
              currentInput: {
                default: { id: 3, b: 'loaded', d: [3] },
                model: { id: 3, b: 'loaded', d: [3] },
              },
              validationPending: false,
              isValid: true,
              validatedInput: {
                default: { id: 3, b: 'loaded', d: [3] },
                model: { id: 3, b: 'loaded', d: [3] },
              },
              validationResult: { b: null },
              resultPending: false,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
          ],
        );
        inputSubject.next(3);
        await sequence;

        const sequence2 = expectSequence(
          store.getBehavior(outputSignals.model).pipe(
            map(m => m.edit),
            distinctUntilChanged(shallowEquals),
            filter(e => e.currentInput === e.validatedInput),
          ),
          [
            {
              currentInput: {
                default: { id: 3, b: 'loaded', d: [3] },
                model: { id: 3, b: 'loaded', d: [3] },
              },
              validationPending: false,
              isValid: true,
              validatedInput: {
                default: { id: 3, b: 'loaded', d: [3] },
                model: { id: 3, b: 'loaded', d: [3] },
              },
              validationResult: { b: null },
              resultPending: false,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            {
              currentInput: {
                default: { id: 3, b: 'loaded', d: [3] },
                model: { id: 3, b: 'exists', d: [3] },
              },
              validationPending: true,
              isValid: false,
              validatedInput: {
                default: { id: 3, b: 'loaded', d: [3] },
                model: { id: 3, b: 'exists', d: [3] },
              },
              validationResult: null,
              resultPending: false,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            {
              currentInput: {
                default: { id: 3, b: 'loaded', d: [3] },
                model: { id: 3, b: 'exists', d: [3] },
              },
              validationPending: true,
              isValid: false,
              validatedInput: {
                default: { id: 3, b: 'loaded', d: [3] },
                model: { id: 3, b: 'exists', d: [3] },
              },
              validationResult: { b: 'exists' },
              resultPending: false,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            {
              currentInput: {
                default: { id: 3, b: 'loaded', d: [3] },
                model: { id: 3, b: 'exists', d: [3] },
              },
              validationPending: false,
              isValid: false,
              validatedInput: {
                default: { id: 3, b: 'loaded', d: [3] },
                model: { id: 3, b: 'exists', d: [3] },
              },
              validationResult: { b: 'exists' },
              resultPending: false,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
          ],
        );
        store.dispatch(inputSignals.update, { b: 'exists' });
        await sequence2;
      });

      it('should give correct result', async () => {
        const sequence = expectSequence(
          store.getBehavior(outputSignals.model).pipe(filter(m => m.disabled === false)),
          [
            {
              load: {
                currentInput: null,
                resultPending: false,
                resultInput: null,
                result: defaultEntity,
              },
              edit: {
                currentInput: {
                  default: defaultEntity,
                  model: defaultEntity,
                },
                validationPending: false,
                isValid: true,
                validatedInput: {
                  default: defaultEntity,
                  model: defaultEntity,
                },
                validationResult: { b: null },
                resultPending: false,
                resultInput: NO_VALUE,
                result: NO_VALUE,
              },
              entity: defaultEntity,
              validation: { b: null },
              loading: false,
              disabled: false,
              changed: false,
            },
          ],
        );
        inputSubject.next(null);
        await sequence;

        const sequence2 = expectSequence(
          store.getBehavior(outputSignals.model).pipe(filter(m => m.disabled === false)),
          [
            {
              load: {
                currentInput: null,
                resultPending: false,
                resultInput: null,
                result: defaultEntity,
              },
              edit: {
                currentInput: {
                  default: defaultEntity,
                  model: defaultEntity,
                },
                validationPending: false,
                isValid: true,
                validatedInput: {
                  default: defaultEntity,
                  model: defaultEntity,
                },
                validationResult: { b: null },
                resultPending: false,
                resultInput: NO_VALUE,
                result: NO_VALUE,
              },
              entity: defaultEntity,
              validation: { b: null },
              loading: false,
              disabled: false,
              changed: false,
            },
            {
              load: {
                currentInput: null,
                resultPending: false,
                resultInput: null,
                result: defaultEntity,
              },
              edit: {
                currentInput: {
                  default: defaultEntity,
                  model: { ...defaultEntity, b: 'updated' },
                },
                validationPending: false,
                isValid: true,
                validatedInput: {
                  default: defaultEntity,
                  model: { ...defaultEntity, b: 'updated' },
                },
                validationResult: { b: null },
                resultPending: false,
                resultInput: NO_VALUE,
                result: NO_VALUE,
              },
              entity: { ...defaultEntity, b: 'updated' },
              validation: { b: null },
              loading: false,
              disabled: false,
              changed: true,
            },
          ],
        );
        store.dispatch(inputSignals.update, { b: 'updated' });
        await sequence2;

        const sequence3 = expectSequence(
          store.getBehavior(outputSignals.model).pipe(filter(m => m.loading === false)),
          [
            {
              load: {
                currentInput: null,
                resultPending: false,
                resultInput: null,
                result: defaultEntity,
              },
              edit: {
                currentInput: {
                  default: defaultEntity,
                  model: { ...defaultEntity, b: 'updated' },
                },
                validationPending: false,
                isValid: true,
                validatedInput: {
                  default: defaultEntity,
                  model: { ...defaultEntity, b: 'updated' },
                },
                validationResult: { b: null },
                resultPending: false,
                resultInput: NO_VALUE,
                result: NO_VALUE,
              },
              entity: { ...defaultEntity, b: 'updated' },
              validation: { b: null },
              loading: false,
              disabled: false,
              changed: true,
            },
            {
              load: {
                currentInput: null,
                resultPending: false,
                resultInput: null,
                result: defaultEntity,
              },
              edit: {
                currentInput: {
                  default: defaultEntity,
                  model: { ...defaultEntity, b: 'updated' },
                },
                validationPending: false,
                isValid: true,
                validatedInput: {
                  default: defaultEntity,
                  model: { ...defaultEntity, b: 'updated' },
                },
                validationResult: { b: null },
                resultPending: false,
                resultInput: {
                  default: defaultEntity,
                  model: { ...defaultEntity, b: 'updated' },
                },
                result: 42,
              },
              entity: { ...defaultEntity, b: 'updated' },
              validation: { b: null },
              loading: false,
              disabled: true,
              changed: true,
            },
          ],
        );
        store.dispatch(inputSignals.save);
        await sequence3;
      });

      it('should trigger reload', async () => {
        const sequence = expectSequence(
          store.getBehavior(outputSignals.model).pipe(
            map(m => m.load),
            distinctUntilChanged(),
          ),
          [
            {
              currentInput: NO_VALUE,
              resultPending: false,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            {
              currentInput: 3,
              resultPending: true,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            {
              currentInput: 3,
              resultPending: true,
              resultInput: 3,
              result: { id: 3, b: 'loaded', d: [3] },
            },
            {
              currentInput: 3,
              resultPending: false,
              resultInput: 3,
              result: { id: 3, b: 'loaded', d: [3] },
            },
          ],
        );
        inputSubject.next(3);
        await sequence;

        const sequence2 = expectSequence(
          store.getBehavior(outputSignals.model).pipe(
            map(m => m.load),
            distinctUntilChanged(),
          ),
          [
            {
              currentInput: 3,
              resultPending: false,
              resultInput: 3,
              result: { id: 3, b: 'loaded', d: [3] },
            },
            {
              currentInput: 3,
              resultPending: true,
              resultInput: 3,
              result: { id: 3, b: 'loaded', d: [3] },
            },
            {
              currentInput: 3,
              resultPending: true,
              resultInput: 3,
              result: { id: 3, b: 'loaded', d: [3] },
            },
            {
              currentInput: 3,
              resultPending: false,
              resultInput: 3,
              result: { id: 3, b: 'loaded', d: [3] },
            },
          ],
        );
        store.dispatch(inputSignals.reload);
        await sequence2;
      });
    });
  });
});
