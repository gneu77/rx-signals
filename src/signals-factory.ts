/* eslint-disable @typescript-eslint/no-use-before-define */
import { Store } from './store';
import { SignalId } from './store-utils';
import { Configuration, merge, Merged, MergedConfiguration } from './type-utils';

/**
 * This type defines an object that maps identifier names to signal ids or nested NameToSignalIds.
 *
 * @typedef {object} NameToSignalId - maps strings on SignalId<any> | NameToSignalId
 */
export type NameToSignalId = Readonly<{ [key: string]: SignalId<any> | NameToSignalId }>;

/**
 * This type defines an object that holds input and output signal ids of a Signals type.
 *
 * @template IN - NameToSignalId defining input signals
 * @template OUT - NameToSignalId defining output signals
 * @typedef {object} SignalIds - maps input- and outmput- NameToSignalId
 */
export type SignalIds<IN extends NameToSignalId, OUT extends NameToSignalId> = Readonly<{
  input: IN;
  output: OUT;
}>;

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
 * This type specifies a function mapping from Signals<T1> to SignalsFactory<T2>, hence
 * the argument to the monadic bind of SignalFactories (hence the argument to FactoryBind<T1,T2>).
 *
 * @typedef {function} SignalsMapToFactory<IN1, OUT1, IN2, OUT2> - function mapping from Signals<IN1, OUT1> to SignalsFactory<IN2, OUT2>
 * @template IN1 - concrete NameToSignalIds defining input signals of the initial SignalsFactory
 * @template OUT1 - concrete NameToSignalIds defining output signals of the initial SignalsFactory
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
 * This type specifies a function mapping from Signals<IN1, OUT1> to Signals<IN2, OUT2>, hence
 * the argument to the functor fmap of SignalFactories (hence the argument to FactoryMap<IN1, OUT1, IN2, OUT2>).
 *
 * @typedef {function} SignalsMapper<IN1, OUT1, IN2, OUT2> - function mapping from Signals<IN1, OUT1> to Signals<IN2, OUT2>
 * @template IN1 - concrete NameToSignalIds defining input signals of the initial SignalsFactory
 * @template OUT1 - concrete NameToSignalIds defining output signals of the initial SignalsFactory
 * @template IN2 - concrete NameToSignalIds defining input signals of the resulting SignalsFactory
 * @template OUT2 - concrete NameToSignalIds defining output signals of the resulting SignalsFactory
 */
export type SignalsMapper<
  IN1 extends NameToSignalId,
  OUT1 extends NameToSignalId,
  IN2 extends NameToSignalId,
  OUT2 extends NameToSignalId,
  CONFIG extends Configuration,
> = (signals: Signals<IN1, OUT1>, config: CONFIG) => Signals<IN2, OUT2>;

/**
 * This type defines a function returning a Signals object, hence a function implementing SignalsFactory.build().
 *
 * @typedef {function} FactoryBuild<IN, OUT> - type for the build method of SignalsFactories
 * @template IN - concrete NameToSignalIds defining input signals of the resulting SignalsFactory
 * @template OUT - concrete NameToSignalIds defining output signals of the resulting SignalsFactory
 */
export type FactoryBuild<
  IN extends NameToSignalId,
  OUT extends NameToSignalId,
  CONFIG extends Configuration,
> = (config: CONFIG) => Signals<IN, OUT>;

export type ComposedFactory<
  IN1 extends NameToSignalId,
  OUT1 extends NameToSignalId,
  CONFIG1 extends Configuration,
  IN2 extends NameToSignalId,
  OUT2 extends NameToSignalId,
  CONFIG2 extends Configuration,
> = SignalsFactory<Merged<IN1, IN2>, Merged<OUT1, OUT2>, MergedConfiguration<CONFIG1, CONFIG2>>;

/**
 * This type defines a function implementing the monadic bind for SignalsFactory<SignalsType>.
 *
 * @typedef {function} FactoryBind<IN1, OUT1> - type for the bind method of SignalsFactories
 * @template IN1 - NameToSignalIds defining input signals provided by the implementing SignalsFactory
 * @template OUT1 - NameToSignalIds defining output signals provided by the implementing SignalsFactory
 * @template IN2 - NameToSignalIds defining input signals provided by the SignalsFactory being the argument to the bind
 * @template OUT2 - NameToSignalIds defining output signals provided by the SignalsFactory being the argument to the bind
 * @property {SignalsMapToFactory<IN1, OUT1, IN2, OUT2>} mapper
 */
export type FactoryBind<
  IN1 extends NameToSignalId,
  OUT1 extends NameToSignalId,
  CONFIG1 extends Configuration,
> = <IN2 extends NameToSignalId, OUT2 extends NameToSignalId, CONFIG2 extends Configuration>(
  mapper: SignalsMapToFactory<IN1, OUT1, CONFIG1, IN2, OUT2, CONFIG2>,
) => ComposedFactory<IN1, OUT1, CONFIG1, IN2, OUT2, CONFIG2>;

/**
 * This type defines a function making SignalsFactory a functor.
 *
 * @typedef {function} FactoryMap<IN1, OUT1> - type for the fmap method of SignalsFactories
 * @template IN1 - NameToSignalIds defining input signals provided by the implementing SignalsFactory
 * @template OUT1 - NameToSignalIds defining output signals provided by the implementing SignalsFactory
 * @template IN2 - NameToSignalIds defining input signals provided by the resulting SignalsFactory
 * @template OUT2 - NameToSignalIds defining output signals provided by the resulting SignalsFactory
 * @property {SignalsMapper<IN1, OUT1, IN2, OUT2>} mapper
 */
export type FactoryMap<
  IN1 extends NameToSignalId,
  OUT1 extends NameToSignalId,
  CONFIG extends Configuration,
> = <IN2 extends NameToSignalId, OUT2 extends NameToSignalId>(
  mapper: SignalsMapper<IN1, OUT1, IN2, OUT2, CONFIG>,
) => SignalsFactory<IN2, OUT2, CONFIG>;

export type ExtendSetup<
  IN extends NameToSignalId,
  OUT extends NameToSignalId,
  CONFIG extends Configuration,
> = (store: Store, input: IN, output: OUT, config: CONFIG) => void;

export type FactoryExtendSetup<
  IN extends NameToSignalId,
  OUT extends NameToSignalId,
  CONFIG extends Configuration,
> = (extendSetup: ExtendSetup<IN, OUT, CONFIG>) => SignalsFactory<IN, OUT, CONFIG>;

export type MapConfig<CONFIG1 extends Configuration, CONFIG2 extends Configuration> = (
  config: CONFIG2,
) => CONFIG1;

export type FactoryMapConfig<
  IN extends NameToSignalId,
  OUT extends NameToSignalId,
  CONFIG1 extends Configuration,
> = <CONFIG2 extends Configuration>(
  mapConfig: MapConfig<CONFIG1, CONFIG2>,
) => SignalsFactory<IN, OUT, CONFIG2>;

export type MapSignalIds<T1 extends NameToSignalId, T2 extends NameToSignalId> = (ids: T1) => T2;

export type FactoryMapInput<
  IN1 extends NameToSignalId,
  OUT extends NameToSignalId,
  CONFIG extends Configuration,
> = <IN2 extends NameToSignalId>(
  mapIds: MapSignalIds<IN1, IN2>,
) => SignalsFactory<IN2, OUT, CONFIG>;

export type FactoryMapOutput<
  IN extends NameToSignalId,
  OUT1 extends NameToSignalId,
  CONFIG extends Configuration,
> = <OUT2 extends NameToSignalId>(
  mapIds: MapSignalIds<OUT1, OUT2>,
) => SignalsFactory<IN, OUT2, CONFIG>;

/**
 * This is the type for signal factories, which represent a higher abstraction over the usage
 * of pure behavior and event composition, to encapsulate common patterns of such composition.
 * It defines a monadic structure, to allow for simple composition of signal factories.
 * Use the createSignalsFactory utility function to create your own SignalsFactories
 * (see the implementation of EffectSignalsFactory for an example).
 *
 * @typedef {object} SignalsFactory<T>
 * @template IN - NameToSignalIds defining input signals provided by the factory
 * @template OUT - NameToSignalIds defining output signals provided by the factory
 * @property {FactoryBuild<IN, OUT>} build - returns Signals<T>, so an object with a setup function (taking a store as argument) and the signals being setup
 * @property {FactoryBind<IN, OUT>} bind - the monadic bind (aka flatMap) to compose with other signal factories
 * @property {FactoryMap<IN, OUT>} fmap - (aka map) the functor map, to map the Signals<T> produced by the factory to different Signals<T2>
 */
export type SignalsFactory<
  IN extends NameToSignalId,
  OUT extends NameToSignalId,
  CONFIG extends Configuration = undefined,
> = Readonly<{
  build: FactoryBuild<IN, OUT, CONFIG>;
  bind: FactoryBind<IN, OUT, CONFIG>;
  fmap: FactoryMap<IN, OUT, CONFIG>;
  extendSetup: FactoryExtendSetup<IN, OUT, CONFIG>;
  mapInput: FactoryMapInput<IN, OUT, CONFIG>;
  mapOutput: FactoryMapOutput<IN, OUT, CONFIG>;
  mapConfig: FactoryMapConfig<IN, OUT, CONFIG>;
}>;

type SignalsFactoryMapCreate = <
  IN1 extends NameToSignalId,
  OUT1 extends NameToSignalId,
  IN2 extends NameToSignalId,
  OUT2 extends NameToSignalId,
  CONFIG extends Configuration,
>(
  factory1: SignalsFactory<IN1, OUT1, CONFIG>,
  mapper: (signals: Signals<IN1, OUT1>, config: CONFIG) => Signals<IN2, OUT2>,
) => SignalsFactory<IN2, OUT2, CONFIG>;

const signalsFactoryExtendSetup = <
  IN extends NameToSignalId,
  OUT extends NameToSignalId,
  CONFIG extends Configuration,
>(
  factory: SignalsFactory<IN, OUT, CONFIG>,
  extendSetup: ExtendSetup<IN, OUT, CONFIG>,
): SignalsFactory<IN, OUT, CONFIG> =>
  factory.fmap((s, config) => ({
    ...s,
    setup: (store: Store) => {
      s.setup(store);
      extendSetup(store, s.input, s.output, config);
    },
  }));

const signalsFactoryMapInput = <
  IN1 extends NameToSignalId,
  OUT extends NameToSignalId,
  CONFIG extends Configuration,
  IN2 extends NameToSignalId,
>(
  factory1: SignalsFactory<IN1, OUT, CONFIG>,
  mapper: MapSignalIds<IN1, IN2>,
): SignalsFactory<IN2, OUT, CONFIG> =>
  factory1.fmap(s => ({
    ...s,
    input: mapper(s.input),
  }));

const signalsFactoryMapOutput = <
  IN extends NameToSignalId,
  OUT1 extends NameToSignalId,
  CONFIG extends Configuration,
  OUT2 extends NameToSignalId,
>(
  factory1: SignalsFactory<IN, OUT1, CONFIG>,
  mapper: MapSignalIds<OUT1, OUT2>,
): SignalsFactory<IN, OUT2, CONFIG> =>
  factory1.fmap(s => ({
    ...s,
    output: mapper(s.output),
  }));

const signalsFactoryMapConfig = <
  IN extends NameToSignalId,
  OUT extends NameToSignalId,
  CONFIG1 extends Configuration,
  CONFIG2 extends Configuration,
>(
  factory1: SignalsFactory<IN, OUT, CONFIG1>,
  mapper: MapConfig<CONFIG1, CONFIG2>,
): SignalsFactory<IN, OUT, CONFIG2> => {
  const build = (config: CONFIG2) => factory1.build(mapper(config));
  let factory2: SignalsFactory<IN, OUT, CONFIG2>;
  const fmap = <IN3 extends NameToSignalId, OUT3 extends NameToSignalId>(
    mapper2: SignalsMapper<IN, OUT, IN3, OUT3, CONFIG2>,
  ): SignalsFactory<IN3, OUT3, CONFIG2> => signalsFactoryMap(factory2, mapper2);
  const bind = <
    IN3 extends NameToSignalId,
    OUT3 extends NameToSignalId,
    CONFIG3 extends Configuration,
  >(
    mapper2: SignalsMapToFactory<IN, OUT, CONFIG2, IN3, OUT3, CONFIG3>,
  ) => signalsFactoryBind(factory2, mapper2);
  const extendSetup = (extend: ExtendSetup<IN, OUT, CONFIG2>): SignalsFactory<IN, OUT, CONFIG2> =>
    signalsFactoryExtendSetup(factory2, extend);
  const mapConfig = <CONFIG3 extends Configuration>(
    mapper2: MapConfig<CONFIG2, CONFIG3>,
  ): SignalsFactory<IN, OUT, CONFIG3> => signalsFactoryMapConfig(factory2, mapper2);
  const mapInput = <IN2 extends NameToSignalId>(mapper2: MapSignalIds<IN, IN2>) =>
    signalsFactoryMapInput(factory2, mapper2);
  const mapOutput = <OUT2 extends NameToSignalId>(mapper2: MapSignalIds<OUT, OUT2>) =>
    signalsFactoryMapOutput(factory2, mapper2);
  factory2 = {
    build,
    bind,
    fmap,
    extendSetup,
    mapConfig,
    mapInput,
    mapOutput,
  };
  return factory2;
};

const signalsFactoryMap: SignalsFactoryMapCreate = <
  IN1 extends NameToSignalId,
  OUT1 extends NameToSignalId,
  IN2 extends NameToSignalId,
  OUT2 extends NameToSignalId,
  CONFIG extends Configuration,
>(
  factory1: SignalsFactory<IN1, OUT1, CONFIG>,
  mapper: SignalsMapper<IN1, OUT1, IN2, OUT2, CONFIG>,
): SignalsFactory<IN2, OUT2, CONFIG> => {
  const build = (config: CONFIG) => mapper(factory1.build(config), config);
  let factory2: SignalsFactory<IN2, OUT2, CONFIG>;
  const fmap = <IN3 extends NameToSignalId, OUT3 extends NameToSignalId>(
    mapper2: SignalsMapper<IN2, OUT2, IN3, OUT3, CONFIG>,
  ): SignalsFactory<IN3, OUT3, CONFIG> => signalsFactoryMap(factory2, mapper2);
  const bind = <
    IN3 extends NameToSignalId,
    OUT3 extends NameToSignalId,
    CONFIG3 extends Configuration,
  >(
    mapper2: SignalsMapToFactory<IN2, OUT2, CONFIG, IN3, OUT3, CONFIG3>,
  ) => signalsFactoryBind(factory2, mapper2);
  const extendSetup = (extend: ExtendSetup<IN2, OUT2, CONFIG>): SignalsFactory<IN2, OUT2, CONFIG> =>
    signalsFactoryExtendSetup(factory2, extend);
  const mapConfig = <CONFIG3 extends Configuration>(
    mapper2: MapConfig<CONFIG, CONFIG3>,
  ): SignalsFactory<IN2, OUT2, CONFIG3> => signalsFactoryMapConfig(factory2, mapper2);
  const mapInput = <IN3 extends NameToSignalId>(mapper2: MapSignalIds<IN2, IN3>) =>
    signalsFactoryMapInput(factory2, mapper2);
  const mapOutput = <OUT3 extends NameToSignalId>(mapper2: MapSignalIds<OUT2, OUT3>) =>
    signalsFactoryMapOutput(factory2, mapper2);
  factory2 = {
    build,
    bind,
    fmap,
    extendSetup,
    mapConfig,
    mapInput,
    mapOutput,
  };
  return factory2;
};

type SignalsFactoryBindCreate = <
  IN1 extends NameToSignalId,
  OUT1 extends NameToSignalId,
  CONFIG1 extends Configuration,
  IN2 extends NameToSignalId,
  OUT2 extends NameToSignalId,
  CONFIG2 extends Configuration,
>(
  factory1: SignalsFactory<IN1, OUT1, CONFIG1>,
  mapper: SignalsMapToFactory<IN1, OUT1, CONFIG1, IN2, OUT2, CONFIG2>,
) => ComposedFactory<IN1, OUT1, CONFIG1, IN2, OUT2, CONFIG2>;

const signalsFactoryBind: SignalsFactoryBindCreate = <
  IN1 extends NameToSignalId,
  OUT1 extends NameToSignalId,
  CONFIG1 extends Configuration,
  IN2 extends NameToSignalId,
  OUT2 extends NameToSignalId,
  CONFIG2 extends Configuration,
>(
  factory1: SignalsFactory<IN1, OUT1, CONFIG1>,
  mapper: SignalsMapToFactory<IN1, OUT1, CONFIG1, IN2, OUT2, CONFIG2>,
): ComposedFactory<IN1, OUT1, CONFIG1, IN2, OUT2, CONFIG2> => {
  const build = (config: MergedConfiguration<CONFIG1, CONFIG2>) => {
    const s1 = factory1.build(config?.c1 as CONFIG1);
    const factory2 = mapper(s1, config?.c1 as CONFIG1);
    const s2 = factory2.build(config?.c2 as CONFIG2);
    return {
      setup: (store: Store) => {
        s1.setup(store);
        s2.setup(store);
      },
      input: merge(s1.input, s2.input),
      output: merge(s1.output, s2.output),
    };
  };
  let factory2: ComposedFactory<IN1, OUT1, CONFIG1, IN2, OUT2, CONFIG2>;
  const bind = <
    IN3 extends NameToSignalId,
    OUT3 extends NameToSignalId,
    CONFIG3 extends Configuration,
  >(
    mapper2: SignalsMapToFactory<
      Merged<IN1, IN2>,
      Merged<OUT1, OUT2>,
      MergedConfiguration<CONFIG1, CONFIG2>,
      IN3,
      OUT3,
      CONFIG3
    >,
  ) => signalsFactoryBind(factory2, mapper2);
  const fmap = <IN3 extends NameToSignalId, OUT3 extends NameToSignalId>(
    mapper2: SignalsMapper<
      Merged<IN1, IN2>,
      Merged<OUT1, OUT2>,
      IN3,
      OUT3,
      MergedConfiguration<CONFIG1, CONFIG2>
    >,
  ): SignalsFactory<IN3, OUT3, MergedConfiguration<CONFIG1, CONFIG2>> =>
    signalsFactoryMap(factory2, mapper2);
  const extendSetup = (
    extend: ExtendSetup<
      Merged<IN1, IN2>,
      Merged<OUT1, OUT2>,
      MergedConfiguration<CONFIG1, CONFIG2>
    >,
  ): ComposedFactory<IN1, OUT1, CONFIG1, IN2, OUT2, CONFIG2> =>
    signalsFactoryExtendSetup(factory2, extend);
  const mapConfig = <CONFIG3 extends Configuration>(
    mapper2: MapConfig<MergedConfiguration<CONFIG1, CONFIG2>, CONFIG3>,
  ): SignalsFactory<Merged<IN1, IN2>, Merged<OUT1, OUT2>, CONFIG3> =>
    signalsFactoryMapConfig(factory2, mapper2);
  const mapInput = <IN3 extends NameToSignalId>(
    mapper2: MapSignalIds<Merged<IN1, IN2>, IN3>,
  ): SignalsFactory<IN3, Merged<OUT1, OUT2>, MergedConfiguration<CONFIG1, CONFIG2>> =>
    signalsFactoryMapInput(factory2, mapper2);
  const mapOutput = <OUT3 extends NameToSignalId>(
    mapper2: MapSignalIds<Merged<OUT1, OUT2>, OUT3>,
  ): SignalsFactory<Merged<IN1, IN2>, OUT3, MergedConfiguration<CONFIG1, CONFIG2>> =>
    signalsFactoryMapOutput(factory2, mapper2);
  factory2 = {
    build,
    bind,
    fmap,
    extendSetup,
    mapConfig,
    mapInput,
    mapOutput,
  };
  return factory2;
};

type SignalsFactoryCreate = <
  IN extends NameToSignalId,
  OUT extends NameToSignalId,
  CONFIG extends Configuration,
>(
  getSignals: FactoryBuild<IN, OUT, CONFIG>,
) => SignalsFactory<IN, OUT, CONFIG>;

/**
 * This utility function creates an object that implements the SignalsFactory type. It should be
 * used to implement all specific signal factories (by just extending the returned object as required).
 * See the implementation of EffectSignalsFactory (which is actually a builder) for an example.
 *
 * @template T - the concrete SignalIds type type for the factory
 * @param {FactoryBuild<T>} build - the function that implements build for SignalsFactory<T>
 * @returns {SignalsFactory<T>}
 */
export const createSignalsFactory: SignalsFactoryCreate = <
  IN1 extends NameToSignalId,
  OUT1 extends NameToSignalId,
  CONFIG1 extends Configuration = undefined,
>(
  getSignals: FactoryBuild<IN1, OUT1, CONFIG1>,
): SignalsFactory<IN1, OUT1, CONFIG1> => {
  let factory: SignalsFactory<IN1, OUT1, CONFIG1>;
  const build = getSignals;
  const bind = <
    IN2 extends NameToSignalId,
    OUT2 extends NameToSignalId,
    CONFIG2 extends Configuration,
  >(
    mapper: SignalsMapToFactory<IN1, OUT1, CONFIG1, IN2, OUT2, CONFIG2>,
  ) => signalsFactoryBind(factory, mapper);
  const fmap = <IN2 extends NameToSignalId, OUT2 extends NameToSignalId>(
    mapper: SignalsMapper<IN1, OUT1, IN2, OUT2, CONFIG1>,
  ) => signalsFactoryMap(factory, mapper);
  const extendSetup = (
    extend: ExtendSetup<IN1, OUT1, CONFIG1>,
  ): SignalsFactory<IN1, OUT1, CONFIG1> => signalsFactoryExtendSetup(factory, extend);
  const mapConfig = <CONFIG3 extends Configuration>(
    mapper2: MapConfig<CONFIG1, CONFIG3>,
  ): SignalsFactory<IN1, OUT1, CONFIG3> => signalsFactoryMapConfig(factory, mapper2);
  const mapInput = <IN2 extends NameToSignalId>(mapper2: MapSignalIds<IN1, IN2>) =>
    signalsFactoryMapInput(factory, mapper2);
  const mapOutput = <OUT2 extends NameToSignalId>(mapper2: MapSignalIds<OUT1, OUT2>) =>
    signalsFactoryMapOutput(factory, mapper2);
  factory = {
    build,
    bind,
    fmap,
    extendSetup,
    mapConfig,
    mapInput,
    mapOutput,
  };
  return factory;
};
