/* eslint-disable @typescript-eslint/no-use-before-define */
import { Store } from './store';
import { SignalId } from './store-utils';
import { Configuration, merge, Merged, MergedConfiguration } from './type-utils';

/**
 * This type defines an object that maps identifier names to signal ids or nested NameToSignalIds.
 *
 * @typedef {object} NameToSignalId - maps strings on SignalId<any> | NameToSignalId
 */
export type NameToSignalId = { [key: string]: SignalId<any> | NameToSignalId };

/**
 * This type defines an object that holds input and output signal ids of a Signals type.
 *
 * @template IN - NameToSignalId defining input signals
 * @template OUT - NameToSignalId defining output signals
 * @typedef {object} SignalIds - maps input- and outmput- NameToSignalId
 */
export type SignalIds<IN extends NameToSignalId, OUT extends NameToSignalId> = {
  readonly input: IN;
  readonly output: OUT;
};

/**
 * This type defines an object with a function 'setup' that takes a store instance
 * as argument and executes the required setup to produce certain signals.
 *
 * @typedef {object} SetupWithStore - has a function setup(store) => void
 */
export type SetupWithStore = {
  readonly setup: (store: Store) => void;
};

/**
 * This type defines an object that encapsulates SignalIds and a function that takes a store
 * and performs the setup of all the corresponding signals.
 *
 * @typedef {object} Signals<IN, OUT> - composition of SetupWithStore and SignalIds<IN, OUT>
 * @template IN - concrete NameToSignalIds defining input signals
 * @template OUT - concrete NameToSignalIds defining output signals
 */
export type Signals<IN extends NameToSignalId, OUT extends NameToSignalId> = SetupWithStore &
  SignalIds<IN, OUT>;

/**
 * This type defines a function returning a Signals object, hence a function implementing SignalsFactory.build().
 *
 * @typedef {function} SignalsBuild<IN, OUT> - constructor argument of SignalsFactories
 * @template IN - concrete NameToSignalIds defining input signals of the resulting SignalsFactory
 * @template OUT - concrete NameToSignalIds defining output signals of the resulting SignalsFactory
 */
export type SignalsBuild<
  IN extends NameToSignalId,
  OUT extends NameToSignalId,
  CONFIG extends Configuration,
> = (config: CONFIG) => Signals<IN, OUT>;

/**
 * This type specifies a function mapping from Signals<T1> to SignalsFactory<T2>, hence
 * the argument to the bind method of SignalFactories.
 *
 * @typedef {function} SignalsMapToFactory<IN1, OUT1, IN2, OUT2> - function mapping from Signals<IN1, OUT1> and CONFIG1 to SignalsFactory<IN2, OUT2, CONFIG2>
 * @template IN1 - concrete NameToSignalIds defining input signals of the initial SignalsFactory Signals
 * @template OUT1 - concrete NameToSignalIds defining output signals of the initial SignalsFactory Signals
 * @template IN2 - concrete NameToSignalIds defining input signals of the resulting SignalsFactory
 * @template OUT2 - concrete NameToSignalIds defining output signals of the resulting SignalsFactory
 */
export type SignalsMapToFactory<
  IN1 extends NameToSignalId,
  OUT1 extends NameToSignalId,
  CONFIG1 extends Configuration,
  IN2 extends NameToSignalId,
  OUT2 extends NameToSignalId,
  CONFIG2 extends Configuration,
> = (signals: Signals<IN1, OUT1>, config: CONFIG1) => SignalsFactory<IN2, OUT2, CONFIG2>;

/**
 * This type specifies the result of the SignalsFactory bind method.
 *
 * @typedef {object} ComposedFactory<IN1, OUT1, CONFIG1, IN2, OUT2, CONFIG2> - result of SignalsFactory<IN1, OUT1, CONFIG1>::bind(SignalsMapToFactory<IN1, OUT1, CONFIG1, IN2, OUT2, CONFIG2>
 * @template IN1 - concrete NameToSignalIds defining input signals of the initial SignalsFactory
 * @template OUT1 - concrete NameToSignalIds defining output signals of the initial SignalsFactory
 * @template IN2 - concrete NameToSignalIds defining input signals of the bound SignalsFactory
 * @template OUT2 - concrete NameToSignalIds defining output signals of the bound SignalsFactory
 */
export type ComposedFactory<
  IN1 extends NameToSignalId,
  OUT1 extends NameToSignalId,
  CONFIG1 extends Configuration,
  IN2 extends NameToSignalId,
  OUT2 extends NameToSignalId,
  CONFIG2 extends Configuration,
> = SignalsFactory<Merged<IN1, IN2>, Merged<OUT1, OUT2>, MergedConfiguration<CONFIG1, CONFIG2>>;

/**
 * This type specifies a function mapping from Signals<IN1, OUT1> to Signals<IN2, OUT2>, hence
 * the argument to the fmap-method of SignalFactories.
 *
 * @typedef {function} SignalsMapper<IN1, OUT1, IN2, OUT2> - function mapping from Signals<IN1, OUT1> and CONFIG to Signals<IN2, OUT2>
 * @template IN1 - concrete NameToSignalIds defining input signals of the initial SignalsFactory Signals
 * @template OUT1 - concrete NameToSignalIds defining output signals of the initial SignalsFactory Signals
 * @template IN2 - concrete NameToSignalIds defining input signals of the resulting SignalsFactory Signals
 * @template OUT2 - concrete NameToSignalIds defining output signals of the resulting SignalsFactory Signals
 */
export type SignalsMapper<
  IN1 extends NameToSignalId,
  OUT1 extends NameToSignalId,
  IN2 extends NameToSignalId,
  OUT2 extends NameToSignalId,
  CONFIG extends Configuration,
> = (signals: Signals<IN1, OUT1>, config: CONFIG) => Signals<IN2, OUT2>;

/**
 * This type specifies the argument to the extendSetup-method of SignalFactories.
 *
 * @typedef {function} ExtendSetup<IN, OUT, CONFIG> - function consuming store, input, output and configuration of a SignalsFactory
 * @template IN - concrete NameToSignalIds defining input signals
 * @template OUT - concrete NameToSignalIds defining output signals
 * @template CONFIG - concrete Configuration
 */
export type ExtendSetup<
  IN extends NameToSignalId,
  OUT extends NameToSignalId,
  CONFIG extends Configuration,
> = (store: Store, input: IN, output: OUT, config: CONFIG) => void;

/**
 * Argument to the mapConfig-method of SignalFactories
 */
export type MapConfig<CONFIG1 extends Configuration, CONFIG2 extends Configuration> = (
  config: CONFIG2,
) => CONFIG1;

/**
 * Argument to the mapInput- and mapOutput method of SignalFactories
 */
export type MapSignalIds<T1 extends NameToSignalId, T2 extends NameToSignalId> = (ids: T1) => T2;

/**
 * AddOrReplaceId is the result type of adding or replacing a key in a NameToSignalId.
 *
 * @typedef {object} AddOrReplaceId<T, N, ID> - the result of adding or replacing { [N]: ID; } on T
 * @template T - concrete NameToSignalIds
 * @template N - string key
 * @template ID - concrete SignalId
 */
export type AddOrReplaceId<
  T extends NameToSignalId,
  N extends string,
  ID extends SignalId<any>,
> = Omit<T, N> & {
  [K in N]: ID;
};

/**
 * The SignalsFactory wraps a SignalsBuild<IN, OUT, CONFIG> function, allowing for simple Signals composition
 * by classic monadic bind method and functor fmap, as well as additional convenience methods.
 * SignalFactory instances are immutable, hence all its methods return a new SignalsFactory instance.
 * (The whole purpose of this class is to provide SignalsBuild composition)
 *
 * @class SignalsFactory<IN extends NameToSignalId, OUT extends NameToSignalId, CONFIG extends Configuration = {}>
 */
export class SignalsFactory<
  IN extends NameToSignalId,
  OUT extends NameToSignalId,
  CONFIG extends Configuration = {},
> {
  /**
   * The constructor takes a pure function implementing SignalsBuild<IN, OUT, CONFIG>.
   *
   * @param {SignalsBuild<IN, OUT, CONFIG>} build - a pure function mapping from CONFIG to Signals<IN, OUT>
   * @constructor
   */
  constructor(readonly build: SignalsBuild<IN, OUT, CONFIG>) {}

  /**
   * The bind method takes as argument a pure function that implements SignalsMapToFactory<IN, OUT, CONFIG, IN2, OUT2, CONFIG2>.
   * It returns a new SignalsFactory that represents the composition of this SignalsFactory and the SignalsFactory returned by the mapper argument.
   *
   * @param {SignalsMapToFactory<IN, OUT, CONFIG, IN2, OUT2, CONFIG2>} mapper - a pure function mapping from Signals<IN, OUT> and CONFIG to SignalsFactory<IN2, OUT2, CONFIG2>
   * @returns {ComposedFactory<IN, OUT, CONFIG, IN2, OUT2, CONFIG2>} - the SignalsFactory resulting from the composition of SignalsFactory<IN, OUT, CONFIG> and SignalsFactory<IN2, OUT2, CONFIG2>
   */
  bind<IN2 extends NameToSignalId, OUT2 extends NameToSignalId, CONFIG2 extends Configuration>(
    mapper: SignalsMapToFactory<IN, OUT, CONFIG, IN2, OUT2, CONFIG2>,
  ): ComposedFactory<IN, OUT, CONFIG, IN2, OUT2, CONFIG2> {
    const build = (config: MergedConfiguration<CONFIG, CONFIG2>) => {
      const s1 = this.build(config?.c1);
      const factory2 = mapper(s1, config?.c1);
      const s2 = factory2.build(config?.c2);
      return {
        setup: (store: Store) => {
          s1.setup(store);
          s2.setup(store);
        },
        input: merge(s1.input, s2.input),
        output: merge(s1.output, s2.output),
      };
    };
    return new SignalsFactory<
      Merged<IN, IN2>,
      Merged<OUT, OUT2>,
      MergedConfiguration<CONFIG, CONFIG2>
    >(build);
  }

  /**
   * The fmap method takes as argument a pure function that implements SignalsMapper<IN, OUT, CONFIG, IN2, OUT2, CONFIG2>.
   * It returns a new SignalsFactory that represents the composition of this SignalsFactory and a SignalsFactory wrapping the Signals returned by the mapper argument.
   *
   * @param {SignalsMapper<IN, OUT, CONFIG, IN2, OUT2, CONFIG2>} mapper - a pure function mapping from Signals<IN, OUT> and CONFIG to Signals<IN2, OUT2>
   * @returns {SignalsFactory<IN2, OUT2, CONFIG>} - the SignalsFactory resulting from the composition of SignalsFactory<IN, OUT, CONFIG> and SignalsFactory<IN2, OUT2, CONFIG>
   */
  fmap<IN2 extends NameToSignalId, OUT2 extends NameToSignalId>(
    mapper: SignalsMapper<IN, OUT, IN2, OUT2, CONFIG>,
  ): SignalsFactory<IN2, OUT2, CONFIG> {
    const build = (config: CONFIG) => mapper(this.build(config), config);
    return new SignalsFactory<IN2, OUT2, CONFIG>(build);
  }

  /**
   * The extendSetup method takes as argument a function that implements ExtendSetup<IN, OUT, CONFIG>.
   * It returns a new SignalsFactory of the same type as this SignalsFactory, but with a wrapped SignalsBuild that extends the code executed in the Signals setup method by the provided code.
   *
   * @param {ExtendSetup<IN, OUT, CONFIG>} extend - a function extending the setup method of the Signals produced by the SignalsBuild of the resulting SignalsFactory
   * @returns {SignalsFactory<IN, OUT, CONFIG>} - a new SignalsFactory with extended store setup
   */
  extendSetup(extend: ExtendSetup<IN, OUT, CONFIG>): SignalsFactory<IN, OUT, CONFIG> {
    return this.fmap((s, config) => ({
      ...s,
      setup: (store: Store) => {
        s.setup(store);
        extend(store, s.input, s.output, config);
      },
    }));
  }

  /**
   * The mapConfig method takes as argument a pure function that implements MapConfig<CONFIG, CONFIG2>.
   * It returns a new SignalsFactory<IN, OUT, CONFIG2>.
   *
   * @param {MapConfig<CONFIG, CONFIG2>} mapper - a pure function mapping CONFIG2 to CONFIG
   * @returns {SignalsFactory<IN, OUT, CONFIG2>} - a new SignalsFactory with different Configuration type
   */
  mapConfig<CONFIG2 extends Configuration>(
    mapper: MapConfig<CONFIG, CONFIG2>,
  ): SignalsFactory<IN, OUT, CONFIG2> {
    const build = (config: CONFIG2) => this.build(mapper(config));
    return new SignalsFactory<IN, OUT, CONFIG2>(build);
  }

  /**
   * The mapInput method takes as argument a pure function that implements MapSignalIds<IN, IN2>.
   * It returns a new SignalsFactory<IN2, OUT, CONFIG>.
   *
   * @param {MapSignalIds<IN, IN2>} mapper - a pure function mapping from IN to IN2
   * @returns {SignalsFactory<IN2, OUT, CONFIG>} - a new SignalsFactory with different input signals
   */
  mapInput<IN2 extends NameToSignalId>(
    mapper: MapSignalIds<IN, IN2>,
  ): SignalsFactory<IN2, OUT, CONFIG> {
    return this.fmap(s => ({
      ...s,
      input: mapper(s.input),
    }));
  }

  /**
   * addOrReplaceInputId can be used as a short alternative to mapInput, if you want
   * to add or replace just a single SignalId to/in the input signal ids.
   *
   * @template K - a concrete string to be used as key for the new SignalId
   * @template ID - a concrete SignalId type
   * @param {K} name - the name of the new SignalId
   * @param {ID} id - the new SignalId
   * @returns {SignalsFactory<AddOrReplaceId<IN, K, ID>, OUT, CONFIG>} - a new SignalsFactory with modified input signals
   */
  addOrReplaceInputId<K extends string, ID extends SignalId<any>>(
    name: K,
    id: ID,
  ): SignalsFactory<AddOrReplaceId<IN, K, ID>, OUT, CONFIG> {
    return this.mapInput<AddOrReplaceId<IN, K, ID>>(input => ({
      ...input,
      [name]: id,
    }));
  }

  /**
   * removeInputId can be used as a short alternative to mapInput, if you want
   * to remove just a single SignalId from the input signal ids.
   *
   * @template K - a concrete K of the input signals of this factory
   * @param {K} name - the name of the SignalId to be removed
   * @returns {SignalsFactory<Omit<IN, K>, OUT, CONFIG>} - a new SignalsFactory with modified input signals
   */
  removeInputId<K extends keyof IN>(name: K): SignalsFactory<Omit<IN, K>, OUT, CONFIG> {
    return this.mapInput<Omit<IN, K>>(input => {
      const result = { ...input };
      delete result[name];
      return result;
    });
  }

  /**
   * The mapOutput method takes as argument a pure function that implements MapSignalIds<OUT, OUT2>.
   * It returns a new SignalsFactory<IN, OUT2, CONFIG>.
   *
   * @param {MapSignalIds<OUT, OUT2>} mapper - a pure function mapping from OUT to OUT2
   * @returns {SignalsFactory<IN, OUT2, CONFIG>} - a new SignalsFactory with different output signals
   */
  mapOutput<OUT2 extends NameToSignalId>(
    mapper: MapSignalIds<OUT, OUT2>,
  ): SignalsFactory<IN, OUT2, CONFIG> {
    return this.fmap(s => ({
      ...s,
      output: mapper(s.output),
    }));
  }

  /**
   * addOrReplaceOutputId can be used as a short alternative to mapOutput, if you want
   * to add or replace just a single SignalId to/in the output signal ids.
   *
   * @template K - a concrete string to be used as key for the new SignalId
   * @template ID - a concrete SignalId type
   * @param {K} name - the name of the new SignalId
   * @param {ID} id - the new SignalId
   * @returns {SignalsFactory<IN, AddOrReplaceId<OUT, K, ID>, CONFIG>} - a new SignalsFactory with modified output signals
   */
  addOrReplaceOutputId<K extends string, ID extends SignalId<any>>(
    name: K,
    id: ID,
  ): SignalsFactory<IN, AddOrReplaceId<OUT, K, ID>, CONFIG> {
    return this.mapOutput<AddOrReplaceId<OUT, K, ID>>(output => ({
      ...output,
      [name]: id,
    }));
  }

  /**
   * removeOutputId can be used as a short alternative to mapOutput, if you want
   * to remove just a single SignalId from the output signal ids.
   *
   * @template K - a concrete K of the output signals of this factory
   * @param {K} name - the name of the SignalId to be removed
   * @returns {SignalsFactory<IN, Omit<OUT, K>, CONFIG>} - a new SignalsFactory with modified output signals
   */
  removeOutputId<K extends keyof OUT>(name: K): SignalsFactory<IN, Omit<OUT, K>, CONFIG> {
    return this.mapOutput<Omit<OUT, K>>(output => {
      const result = { ...output };
      delete result[name];
      return result;
    });
  }
}
