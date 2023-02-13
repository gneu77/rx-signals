import { Store } from '../src/store';
import { expectSequence } from '../src/test-utils/test-utils';
import {
  getModelSignalsFactory,
  ModelInputSignals,
  ModelOutputSignals,
} from './../src/model-signals-factory';

describe('ModelSignalsFactory', () => {
  let store: Store;

  beforeEach(() => {
    store = new Store();
  });

  describe('object shape model', () => {
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

    let inputSignals: ModelInputSignals<ModelType>;
    let outputSignals: ModelOutputSignals<ModelType>;

    beforeEach(() => {
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

    it('should have correct combined state after setting a new model', async () => {
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
      const sequence = expectSequence(store.getBehavior(outputSignals.modelWithDefault), [
        { model: defaultModel, default: defaultModel },
        { model: newModel, default: defaultModel },
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

    it('should have correct combined state after shallow-updating the model', async () => {
      const sequence = expectSequence(store.getBehavior(outputSignals.modelWithDefault), [
        { model: defaultModel, default: defaultModel },
        {
          model: {
            ...defaultModel,
            b: 42,
          },
          default: defaultModel,
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

    it('should have correct combined state after deep-updating the model', async () => {
      const sequence = expectSequence(store.getBehavior(outputSignals.modelWithDefault), [
        { model: defaultModel, default: defaultModel },
        {
          model: {
            ...defaultModel,
            c: {
              d: {
                e: true,
              },
              f: 9,
            },
          },
          default: defaultModel,
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

    it('should reset the model to initial default', async () => {
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

    it('should set correct combined state on reset', async () => {
      const newModel = {
        a: 'NewModel',
        b: 42,
        c: {
          f: 38,
        },
      };
      const sequence = expectSequence(store.getBehavior(outputSignals.modelWithDefault), [
        { model: defaultModel, default: defaultModel },
        { model: newModel, default: defaultModel },
        { model: defaultModel, default: defaultModel },
      ]);
      store.dispatch(inputSignals.set, newModel);
      store.dispatch(inputSignals.reset);
      await sequence;
    });

    it('should reset the model to a set default', async () => {
      const newModel = {
        a: 'NewModel',
        b: 42,
        c: {
          f: 38,
        },
      };
      const newModel2 = {
        a: 'NewModel2',
        b: 7,
        c: {
          f: 8,
        },
      };
      const sequence = expectSequence(store.getBehavior(outputSignals.model), [
        defaultModel,
        newModel,
        newModel2,
        newModel,
      ]);
      store.dispatch(inputSignals.setAsDefault, newModel);
      store.dispatch(inputSignals.set, newModel2);
      store.dispatch(inputSignals.reset);
      await sequence;
    });
  });

  describe('union with object shape model', () => {
    type ModelType =
      | null
      | number
      | {
          a: string;
          b: number;
          c: {
            d?: {
              e: boolean;
            };
            f: number;
          };
        };
    const defaultModel: ModelType = null;

    const baseFactory = getModelSignalsFactory<ModelType>();

    let inputSignals: ModelInputSignals<ModelType>;
    let outputSignals: ModelOutputSignals<ModelType>;

    beforeEach(() => {
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

    it('should allow no partial types', async () => {
      const expected = {
        a: 'Test',
        b: 7,
        c: {
          f: 9,
        },
      };
      const sequence = expectSequence(store.getBehavior(outputSignals.model), [
        defaultModel,
        expected,
      ]);
      // store.dispatch(inputSignals.update, { b: 42 }); // must not compile
      store.dispatch(inputSignals.update, expected);
      await sequence;
    });

    it('should allow no deep-update', async () => {
      const sequence = expectSequence(store.getBehavior(outputSignals.model), [defaultModel, 42]);
      // store.dispatch(inputSignals.updateDeep, { c: { f: 42 } }); // must not compile
      store.dispatch(inputSignals.updateDeep, 42);
      await sequence;
    });

    it('should update by function', async () => {
      const sequence = expectSequence(store.getBehavior(outputSignals.model), [defaultModel, 9]);
      store.dispatch(inputSignals.updateBy, () => 9);
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

  describe('primitive model', () => {
    const baseFactory = getModelSignalsFactory<string | number>();

    let inputSignals: ModelInputSignals<string | number>;
    let outputSignals: ModelOutputSignals<string | number>;

    beforeEach(() => {
      const signals = baseFactory.build({
        defaultModel: 'TEST',
      });
      signals.setup(store);
      inputSignals = signals.input;
      outputSignals = signals.output;
    });

    it('should give the default model', async () => {
      const sequence = expectSequence(store.getBehavior(outputSignals.model), ['TEST']);
      await sequence;
    });

    it('should set a new model', async () => {
      const sequence = expectSequence(store.getBehavior(outputSignals.model), ['TEST', 42]);
      store.dispatch(inputSignals.set, 42);
      await sequence;
    });

    it('update should equal set in case of primitive value-types', async () => {
      const sequence = expectSequence(store.getBehavior(outputSignals.model), ['TEST', 7]);
      store.dispatch(inputSignals.update, 7);
      await sequence;
    });

    it('deep-update should equal set in case of primitive value-types', async () => {
      const sequence = expectSequence(store.getBehavior(outputSignals.model), ['TEST', 9]);
      store.dispatch(inputSignals.updateDeep, 9);
      await sequence;
    });

    it('should update by function', async () => {
      const sequence = expectSequence(store.getBehavior(outputSignals.model), ['TEST', 'TEST2']);
      store.dispatch(inputSignals.updateBy, m => m + '2');
      await sequence;
    });

    it('should reset the model', async () => {
      const sequence = expectSequence(store.getBehavior(outputSignals.model), ['TEST', 42, 'TEST']);
      store.dispatch(inputSignals.set, 42);
      store.dispatch(inputSignals.reset);
      await sequence;
    });
  });
});
