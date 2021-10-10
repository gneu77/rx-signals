/* eslint-disable @typescript-eslint/no-use-before-define */
import { Store } from './store';
import { TypeIdentifier } from './store.utils';

/**
 * This type defines an object that maps identifier names on type identifiers.
 *
 * @typedef {object} SignalIds - maps strings on TypeIdentifier<any> | SignalIds
 */
export type SignalIds = { [key: string]: TypeIdentifier<any> | SignalIds };

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
 * This type defines a wrapper object that has a field 'signals' mapping to a SignalIds object.
 *
 * @typedef {object} SignalTypes<T extends SignalIds> - wrapper for a SignalsIds object
 * @template T - a concrete SignalIds type, specifying the signal identifiers (so an object with TypeIdentifier<T> as values)
 */
export type SignalTypes<T extends SignalIds> = {
  readonly signals: T;
};

/**
 * In contrast to SignalTypes, this type defines a wrapper object that has two fields 'signals1'
 * and 'signals2' mapping to SignalIds objects. It is the default SignalTypes object of the
 * SignalsFactory resulting from a SignalsFactory.bind().
 * So 'signals1' is the SignalsTypes object of the first SignalsFactory and 'signals2' is the
 * SignalsTypes of the bound SignalsFactory.
 *
 * @typedef {object} MappedSignalTypes<T1 extends SignalIds, T2 extends SignalIds> - wrapper for signal types of a SignalsFactory resulting from a bind()
 * @template T1 - a concrete SignalIds type, specifying the signal identifiers of the initial SignalsFactory
 * @template T2 - a concrete SignalIds type, specifying the signal identifiers of the SignalsFactory that was used as argument to SignalsFactory.bind()
 */
export type MappedSignalTypes<T1 extends SignalIds, T2 extends SignalIds> = Readonly<{
  signals1: T1;
  signals2: T2;
}>;

/**
 * This type defines an object that encapsulates SignalIds and a function that takes a store
 * and performs the setup of all the corresponding signals.
 *
 * @typedef {object} Signals<T> - composition of SetupWithStore and SignalTypes<T>
 * @template T - a concrete SignalIds type
 */
export type Signals<T extends SignalIds> = SetupWithStore & SignalTypes<T>;

/**
 * This type specifies a function mapping from Signals<T1> to SignalsFactory<T2>, hence
 * the argument to the monadic bind of SignalFactories (hence the argument to FactoryBind<T1,T2>).
 *
 * @typedef {function} SignalsMapToFactory<T1 extends SignalIds, T2 extends SignalIds> - function mapping from Signals<T1> to SignalsFactory<T2>
 * @template T1 - the concrete SignalIds type of the initial SignalsFactory
 * @template T2 - the concrete SignalIds type of the resulting SignalsFactory
 */
export type SignalsMapToFactory<T1 extends SignalIds, T2 extends SignalIds> = (
  signals: Signals<T1>,
) => SignalsFactory<T2>;

/**
 * This type specifies a function mapping from Signals<T1> to Signals<T2>, hence
 * the argument to the functor fmap of SignalFactories (hence the argument to FactoryMap<T1,T2>).
 *
 * @typedef {function} SignalsMapper<T1 extends SignalIds, T2 extends SignalIds> - function mapping from Signals<T1> to Signals<T2>
 * @template T1 - the concrete SignalIds type of the initial SignalsFactory
 * @template T2 - the concrete SignalIds type of the resulting SignalsFactory
 */
export type SignalsMapper<T1 extends SignalIds, T2 extends SignalIds> = (
  signals: Signals<T1>,
) => Signals<T2>;

/**
 * This type defines a function returning a Signals object, hence a function implementing SignalsFactory.build().
 *
 * @typedef {function} FactoryBuild<SignalsType> - type for the build method of SignalsFactories
 * @template T - the concrete SignalIds type of the resulting Signals
 */
export type FactoryBuild<T extends SignalIds> = () => Signals<T>;

/**
 * This type defines a function implementing the monadic bind for SignalsFactory<SignalsType>.
 *
 * @typedef {function} FactoryBind<T1> - type for the bind method of SignalsFactories
 * @template T1 - the concrete SignalIds provided by the implementing SignalsFactory
 * @template T2 - the concrete SignalIds provided by the SignalsFactory being the argument to the bind
 * @property {SignalsMapToFactory<T1, T2>} mapper
 */
export type FactoryBind<T1 extends SignalIds> = <T2 extends SignalIds>(
  mapper: SignalsMapToFactory<T1, T2>,
) => SignalsFactory<MappedSignalTypes<T1, T2>>;

/**
 * This type defines a function making SignalsFactory a functor.
 *
 * @typedef {function} FactoryMap<T1> - type for the fmap method of SignalsFactories
 * @template T1 - the concrete SignalIds provided by the implementing SignalsFactory
 * @template T2 - the concrete SignalIds provided by the resulting SignalsFactory
 * @property {SignalsMapper<T1, T2>} mapper
 */
export type FactoryMap<T1 extends SignalIds> = <T2 extends SignalIds>(
  mapper: SignalsMapper<T1, T2>,
) => SignalsFactory<T2>;

/**
 * This is the type for signal factories, which represent a higher abstraction over the usage
 * of pure behavior and event composition, to encapsulate common patterns of such composition.
 * It defines a monadic structure, to allow for simple composition of signal factories.
 * Use the createSignalsFactory utility function to create your own SignalsFactories
 * (see the implementation of EffectSignalsFactory for an example).
 *
 * @typedef {object} SignalsFactory<T>
 * @template T - the concrete SignalIds provided by the factory
 * @property {FactoryBuild<T>} build - returns Signals<T>, so an object with a setup function (taking a store as argument) and the signals being setup
 * @property {FactoryBind<T>} bind - the monadic bind (aka flatMap) to compose with other signal factories
 * @property {FactoryMap<T>} fmap - (aka map) the functor map, to map the Signals<T> produced by the factory to different Signals<T2>
 */
export type SignalsFactory<T extends SignalIds> = Readonly<{
  build: FactoryBuild<T>;
  bind: FactoryBind<T>;
  fmap: FactoryMap<T>;
}>;

type SignalsFactoryMapCreate = <T1 extends SignalIds, T2 extends SignalIds>(
  factory1: SignalsFactory<T1>,
  mapper: (signals: Signals<T1>) => Signals<T2>,
) => SignalsFactory<T2>;

const signalsFactoryMap: SignalsFactoryMapCreate = <T1 extends SignalIds, T2 extends SignalIds>(
  factory1: SignalsFactory<T1>,
  mapper: SignalsMapper<T1, T2>,
): SignalsFactory<T2> => {
  const newBuild = () => mapper(factory1.build());
  let factory2: SignalsFactory<T2>;
  const newMap = <T3 extends SignalIds>(mapper2: SignalsMapper<T2, T3>): SignalsFactory<T3> =>
    signalsFactoryMap(factory2, mapper2);
  const newBind = <T3 extends SignalIds>(mapper2: SignalsMapToFactory<T2, T3>) =>
    signalsFactoryBind(factory2, mapper2);
  factory2 = {
    build: newBuild,
    bind: newBind,
    fmap: newMap,
  };
  return factory2;
};

type SignalsFactoryBindCreate = <T1 extends SignalIds, T2 extends SignalIds>(
  factory1: SignalsFactory<T1>,
  mapper: SignalsMapToFactory<T1, T2>,
) => SignalsFactory<MappedSignalTypes<T1, T2>>;

const signalsFactoryBind: SignalsFactoryBindCreate = <T1 extends SignalIds, T2 extends SignalIds>(
  factory1: SignalsFactory<T1>,
  mapper: SignalsMapToFactory<T1, T2>,
): SignalsFactory<MappedSignalTypes<T1, T2>> => {
  const newBuild = () => {
    const s1 = factory1.build();
    const factory2 = mapper(s1);
    const s2 = factory2.build();
    return {
      setup: (store: Store) => {
        s1.setup(store);
        s2.setup(store);
      },
      signals: {
        signals1: s1.signals,
        signals2: s2.signals,
      },
    };
  };
  let factory2: SignalsFactory<MappedSignalTypes<T1, T2>>;
  const newBind = <T3 extends SignalIds>(
    mapper2: SignalsMapToFactory<MappedSignalTypes<T1, T2>, T3>,
  ) => signalsFactoryBind(factory2, mapper2);
  const newMap = <T3 extends SignalIds>(
    mapper2: SignalsMapper<MappedSignalTypes<T1, T2>, T3>,
  ): SignalsFactory<T3> => signalsFactoryMap(factory2, mapper2);
  factory2 = {
    build: newBuild,
    bind: newBind,
    fmap: newMap,
  };
  return factory2;
};

type SignalsFactoryCreate = <T extends SignalIds>(build: () => Signals<T>) => SignalsFactory<T>;

/**
 * This utility function creates an object that implements the SignalsFactory type. It should be
 * used to implement all specific signal factories (by just extending the returned object as required).
 * See the implementation of EffectSignalsFactory (which is actually a builder) for an example.
 *
 * @template T - the concrete SignalIds type type for the factory
 * @param {FactoryBuild<T>} build - the function that implements build for SignalsFactory<T>
 * @returns {SignalsFactory<T>}
 */
export const createSignalsFactory: SignalsFactoryCreate = <T1 extends SignalIds>(
  build: FactoryBuild<T1>,
): SignalsFactory<T1> => {
  let factory: SignalsFactory<T1>;
  const bind = <T2 extends SignalIds>(mapper: SignalsMapToFactory<T1, T2>) =>
    signalsFactoryBind(factory, mapper);
  const fmap = <T2 extends SignalIds>(mapper: SignalsMapper<T1, T2>) =>
    signalsFactoryMap(factory, mapper);
  factory = {
    build,
    bind,
    fmap,
  };
  return factory;
};
