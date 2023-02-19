import { Subject, distinctUntilChanged, filter, of, startWith } from 'rxjs';
import { delay, map, switchMap } from 'rxjs/operators';
import { Effect, Store } from '../src/store';
import { NO_VALUE } from '../src/store-utils';
import { expectSequence } from '../src/test-utils/test-utils';
import {
  EntityEditEffects,
  EntityEditInput,
  EntityEditOutput,
  getEntityEditSignalsFactory,
  shallowEquals,
} from './../src/entity-edit-signals-factory';
import { ModelValidationResult, patchModelValidationResult, toGetter } from './../src/type-utils';

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
            currentInput: defaultEntity,
            validationPending: true,
            isValid: false,
            validatedInput: NO_VALUE,
            validationResult: NO_VALUE,
            resultPending: false,
            resultInput: NO_VALUE,
            result: NO_VALUE,
          },
          {
            currentInput: { ...defaultEntity, id: 5 },
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
              currentInput: defaultEntity,
              validationPending: true,
              isValid: false,
              validatedInput: NO_VALUE,
              validationResult: NO_VALUE,
              resultPending: false,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            entity: defaultEntity,
            validation: null,
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
              currentInput: defaultEntity,
              validationPending: true,
              isValid: false,
              validatedInput: NO_VALUE,
              validationResult: NO_VALUE,
              resultPending: false,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            entity: defaultEntity,
            validation: null,
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
              currentInput: expectedEntity,
              validationPending: true,
              isValid: false,
              validatedInput: NO_VALUE,
              validationResult: NO_VALUE,
              resultPending: false,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            entity: expectedEntity,
            validation: null,
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
      const loadEffect: Effect<number | null, MyEntity> = (id: number | null) => {
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

      const validationEffect: Effect<MyEntity, ModelValidationResult<MyEntity>> = (
        input: MyEntity,
        _,
        prevInput,
        prevResult,
      ) =>
        of<ModelValidationResult<MyEntity>>(input.d.length < 1 ? { d: 'min size 1' } : null).pipe(
          map(v => (!!input.b ? v : patchModelValidationResult(v, { b: 'mandatory' }))), // 'b' is mandatory
          switchMap(
            v =>
              (toGetter(v)('b').get() ?? null) !== null // is 'b' already validated as being missing?
                ? of(v) // 'b' is missing, so validation is finished (it cannot have unique violation)
                : toGetter(prevInput)('b').get() === input.b // is current 'b' the same as in the previous input?
                ? of(patchModelValidationResult(v, { b: toGetter(prevResult)('b').get() })) // it's the same, so we can take it's previous validation result
                : of(
                    // it's not the same, so "we have to call our backend to validate uniqueness"
                    patchModelValidationResult(v, { b: input.b === 'exists' ? 'exists' : null }),
                  ).pipe(delay(10), startWith(v)), // while the "backend call is running" (the delay), we already dispatch the validation so far
          ),
        );

      const saveEffect: Effect<MyEntity, number> = (input: MyEntity) => {
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
              currentInput: defaultEntity,
              validationPending: true,
              isValid: false,
              validatedInput: NO_VALUE,
              validationResult: NO_VALUE,
              resultPending: false,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            entity: defaultEntity,
            validation: null,
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
              currentInput: defaultEntity,
              validationPending: true,
              isValid: false,
              validatedInput: NO_VALUE,
              validationResult: NO_VALUE,
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
              currentInput: defaultEntity,
              validationPending: true,
              isValid: false,
              validatedInput: defaultEntity,
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
              currentInput: defaultEntity,
              validationPending: true,
              isValid: false,
              validatedInput: defaultEntity,
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
              currentInput: defaultEntity,
              validationPending: false,
              isValid: true,
              validatedInput: defaultEntity,
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
              currentInput: defaultEntity,
              validationPending: false,
              isValid: true,
              validatedInput: defaultEntity,
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
              currentInput: defaultEntity,
              validationPending: false,
              isValid: true,
              validatedInput: defaultEntity,
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
              currentInput: { id: 3, b: 'loaded', d: [3] },
              validationPending: true,
              isValid: false,
              validatedInput: defaultEntity,
              validationResult: { b: null },
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
              currentInput: { id: 3, b: 'loaded', d: [3] },
              validationPending: true,
              isValid: false,
              validatedInput: { id: 3, b: 'loaded', d: [3] },
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
              currentInput: { id: 3, b: 'loaded', d: [3] },
              validationPending: true,
              isValid: false,
              validatedInput: { id: 3, b: 'loaded', d: [3] },
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
              currentInput: { id: 3, b: 'loaded', d: [3] },
              validationPending: false,
              isValid: true,
              validatedInput: { id: 3, b: 'loaded', d: [3] },
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
              currentInput: defaultEntity,
              validationPending: true,
              isValid: false,
              validatedInput: defaultEntity,
              validationResult: null,
              resultPending: false,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            {
              currentInput: defaultEntity,
              validationPending: true,
              isValid: false,
              validatedInput: defaultEntity,
              validationResult: { b: null },
              resultPending: false,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            {
              currentInput: defaultEntity,
              validationPending: false,
              isValid: true,
              validatedInput: defaultEntity,
              validationResult: { b: null },
              resultPending: false,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            {
              currentInput: { id: 3, b: 'loaded', d: [3] },
              validationPending: true,
              isValid: false,
              validatedInput: { id: 3, b: 'loaded', d: [3] },
              validationResult: null,
              resultPending: false,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            {
              currentInput: { id: 3, b: 'loaded', d: [3] },
              validationPending: true,
              isValid: false,
              validatedInput: { id: 3, b: 'loaded', d: [3] },
              validationResult: { b: null },
              resultPending: false,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            {
              currentInput: { id: 3, b: 'loaded', d: [3] },
              validationPending: false,
              isValid: true,
              validatedInput: { id: 3, b: 'loaded', d: [3] },
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
              currentInput: { id: 3, b: 'loaded', d: [3] },
              validationPending: false,
              isValid: true,
              validatedInput: { id: 3, b: 'loaded', d: [3] },
              validationResult: { b: null },
              resultPending: false,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            {
              currentInput: { id: 3, b: 'exists', d: [3] },
              validationPending: true,
              isValid: false,
              validatedInput: { id: 3, b: 'exists', d: [3] },
              validationResult: null,
              resultPending: false,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            {
              currentInput: { id: 3, b: 'exists', d: [3] },
              validationPending: true,
              isValid: false,
              validatedInput: { id: 3, b: 'exists', d: [3] },
              validationResult: { b: 'exists' },
              resultPending: false,
              resultInput: NO_VALUE,
              result: NO_VALUE,
            },
            {
              currentInput: { id: 3, b: 'exists', d: [3] },
              validationPending: false,
              isValid: false,
              validatedInput: { id: 3, b: 'exists', d: [3] },
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
                currentInput: 3,
                resultPending: false,
                resultInput: 3,
                result: { id: 3, b: 'loaded', d: [3] },
              },
              edit: {
                currentInput: defaultEntity,
                validationPending: false,
                isValid: true,
                validatedInput: defaultEntity,
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
                currentInput: { id: 3, b: 'loaded', d: [3] },
                validationPending: false,
                isValid: true,
                validatedInput: { id: 3, b: 'loaded', d: [3] },
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
          ],
        );
        inputSubject.next(3);
        await sequence;

        const sequence2 = expectSequence(
          store.getBehavior(outputSignals.model).pipe(filter(m => m.disabled === false)),
          [
            {
              load: {
                currentInput: 3,
                resultPending: false,
                resultInput: 3,
                result: { id: 3, b: 'loaded', d: [3] },
              },
              edit: {
                currentInput: { id: 3, b: 'loaded', d: [3] },
                validationPending: false,
                isValid: true,
                validatedInput: { id: 3, b: 'loaded', d: [3] },
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
            {
              load: {
                currentInput: 3,
                resultPending: false,
                resultInput: 3,
                result: { id: 3, b: 'loaded', d: [3] },
              },
              edit: {
                currentInput: { id: 3, b: 'loaded', d: [3] },
                validationPending: false,
                isValid: true,
                validatedInput: { id: 3, b: 'loaded', d: [3] },
                validationResult: { b: null },
                resultPending: false,
                resultInput: { id: 3, b: 'loaded', d: [3] },
                result: 3,
              },
              entity: { id: 3, b: 'loaded', d: [3] },
              validation: { b: null },
              loading: false,
              disabled: false,
              changed: false,
            },
          ],
        );
        store.dispatch(inputSignals.save);
        await sequence2;
      });
    });
  });
});
