import { Subject } from 'rxjs';
import { Store } from '../src/store';
import { NO_VALUE } from '../src/store-utils';
import { expectSequence } from '../src/test-utils/test-utils';
import {
  EntityEditInput,
  EntityEditOutput,
  getEntityEditSignalsFactory,
} from './../src/entity-edit-signals-factory';

type MyEntity = {
  id: number;
  b: {
    c: string;
  };
  d: string[];
};

const defaultEntity = {
  id: 42,
  b: {
    c: 'test',
  },
  d: ['x', 'y', 'z'],
};

describe('EntityEditSignalsFactory', () => {
  const baseFactory = getEntityEditSignalsFactory<MyEntity>();
  let store: Store;
  let inputSignals: EntityEditInput<MyEntity>;
  let outputSignals: EntityEditOutput<MyEntity>;
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
      store.connectObservable(inputSubject, inputSignals.load);
    });

    describe('without added effects', () => {
      it('should give load behavior without any effect being added', async () => {
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

      it('should give edit behavior without any effect being added', async () => {
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
        ]);
        await sequence;
      });

      it('should give a model without any effect being added', async () => {
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

      it('should update model behavior without any effect being added', async () => {
        const expectedEntity = {
          ...defaultEntity,
          d: ['X'],
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
        store.dispatch(inputSignals.updateDeep, { d: ['X'] });
        await sequence;
      });
    });
  });
});
