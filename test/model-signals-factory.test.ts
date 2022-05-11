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
  };
  const defaultModel = {
    a: 'Test',
    b: 7,
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
    };
    const sequence = expectSequence(store.getBehavior(outputSignals.model), [
      defaultModel,
      newModel,
    ]);
    store.dispatch(inputSignals.setModel, newModel);
    await sequence;
  });

  it('should update the model', async () => {
    const sequence = expectSequence(store.getBehavior(outputSignals.model), [
      defaultModel,
      {
        ...defaultModel,
        b: 42,
      },
    ]);
    store.dispatch(inputSignals.updateModel, { b: 42 });
    await sequence;
  });

  it('should reset the model', async () => {
    const newModel = {
      a: 'NewModel',
      b: 42,
    };
    const sequence = expectSequence(store.getBehavior(outputSignals.model), [
      defaultModel,
      newModel,
      defaultModel,
    ]);
    store.dispatch(inputSignals.setModel, newModel);
    store.dispatch(inputSignals.resetModel);
    await sequence;
  });
});
