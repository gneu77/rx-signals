import { Store } from '../src/store';
import { expectSequence } from '../src/test-utils/test-utils';
import {
  getModelSignalsFactory,
  ModelInputSignals,
  ModelOutputSignals,
} from './../src/model-signals-factory';

describe('ModelSignalsFactory', () => {
  type ModelType = {
    a: string;
    b: number;
    c: {
      d?: {
        e: boolean;
      };
      f: number;
    };
  };
  const defaultModel: ModelType = {
    a: 'Test',
    b: 7,
    c: {
      f: 9,
    },
  };

  const baseFactory = getModelSignalsFactory<ModelType>();

  let store: Store;
  let inputSignals: ModelInputSignals<ModelType>;
  let outputSignals: ModelOutputSignals<ModelType>;

  beforeEach(() => {
    store = new Store();
    const signals = baseFactory.build({
      defaultModel,
    });
    signals.setup(store);
    inputSignals = signals.input;
    outputSignals = signals.output;
  });

  it('should give the default model', async () => {
    const sequence = expectSequence(store.getBehavior(outputSignals.model), [defaultModel]);
    await sequence;
  });

  it('should set a new model', async () => {
    const newModel = {
      a: 'NewModel',
      b: 42,
      c: {
        d: {
          e: false,
        },
        f: 17,
      },
    };
    const sequence = expectSequence(store.getBehavior(outputSignals.model), [
      defaultModel,
      newModel,
    ]);
    store.dispatch(inputSignals.set, newModel);
    await sequence;
  });

  it('should shallow-update the model', async () => {
    const sequence = expectSequence(store.getBehavior(outputSignals.model), [
      defaultModel,
      {
        ...defaultModel,
        b: 42,
      },
    ]);
    store.dispatch(inputSignals.update, { b: 42 });
    await sequence;
  });

  it('should deep-update the model 1', async () => {
    const sequence = expectSequence(store.getBehavior(outputSignals.model), [
      defaultModel,
      {
        ...defaultModel,
        c: {
          f: 42,
        },
      },
    ]);
    store.dispatch(inputSignals.updateDeep, { c: { f: 42 } });
    await sequence;
  });

  it('should deep-update the model 2', async () => {
    const sequence = expectSequence(store.getBehavior(outputSignals.model), [
      defaultModel,
      {
        ...defaultModel,
        c: {
          d: {
            e: true,
          },
          f: 9,
        },
      },
    ]);
    store.dispatch(inputSignals.updateDeep, { c: { d: { e: true } } });
    await sequence;
  });

  it('should update by function', async () => {
    const sequence = expectSequence(store.getBehavior(outputSignals.model), [
      defaultModel,
      {
        ...defaultModel,
        b: 42,
      },
    ]);
    store.dispatch(inputSignals.updateBy, m => ({ ...m, b: 42 }));
    await sequence;
  });

  it('should reset the model', async () => {
    const newModel = {
      a: 'NewModel',
      b: 42,
      c: {
        f: 38,
      },
    };
    const sequence = expectSequence(store.getBehavior(outputSignals.model), [
      defaultModel,
      newModel,
      defaultModel,
    ]);
    store.dispatch(inputSignals.set, newModel);
    store.dispatch(inputSignals.reset);
    await sequence;
  });
});
