/* eslint-disable @typescript-eslint/no-use-before-define */
import { Store } from './store';
import { TypeIdentifier } from './store.utils';

export type SignalIds = { [key: string]: TypeIdentifier<any> | SignalIds };

export type SetupWithStore = {
  readonly setup: (store: Store) => void;
};

export type SignalTypes<T extends SignalIds> = {
  readonly signals: T;
};

export type MappedSignalTypes<T1 extends SignalIds, T2 extends SignalIds> = Readonly<{
  signals1: T1;
  signals2: T2;
}>;

/**
 * This type defined an object that encapsulates signal identifiers and
 * a function that takes a store and performs the setup of all the signals .
 *
 * @typedef {object} Signals<SignalType> - composition of SetupWithStore and SignalsTypeWrapper<SignalsType>
 * @template T - specifies the type holding the signal identifiers (so an object with TypeIdentifier<T> as values)
 */
export type Signals<T extends SignalIds> = SetupWithStore & SignalTypes<T>;

export type SignalsMapToFactory<T1 extends SignalIds, T2 extends SignalIds> = (
  signals: Signals<T1>,
) => SignalsFactory<T2>;

export type SignalsMapper<T1 extends SignalIds, T2 extends SignalIds> = (
  signals: Signals<T1>,
) => Signals<T2>;

/**
 * This type defines a function returning an Signals<SignalsType> object.
 *
 * @typedef {function} FactoryBuild<SignalsType> - type for the build method of SignalsFactories
 * @template SignalsType - specifies the type for signals provided by the implementing factory
 */
export type FactoryBuild<T extends SignalIds> = () => Signals<T>;

/**
 * This type defines a function implementing the monadic bind for SignalsFactory<SignalsType>.
 *
 * @typedef {function} FactoryBind<SignalsType> - type for the build method of SignalsFactories
 * @template SignalsType - specifies the type for signals provided by the implementing factory
 * @property {SignalsMapToFactory<SignalsType, SignalsType2>} mapper
 */
export type FactoryBind<T1 extends SignalIds> = <T2 extends SignalIds>(
  mapper: SignalsMapToFactory<T1, T2>,
) => SignalsFactory<MappedSignalTypes<T1, T2>>;

export type FactoryMap<T1 extends SignalIds> = <T2 extends SignalIds>(
  mapper: SignalsMapper<T1, T2>,
) => SignalsFactory<T2>;

/**
 * This is the interface for signal factories, which represent a higher abstraction over the usage
 * of pure behavior and event composition, to encapsulate common patterns of such composition.
 * The interface defines a monadic structure, to allow for simple composition of signal factories.
 * Use the createSignalsFactory utility function to create your own SignalsFactory (see the implementation
 * of EffectSignalsFactory for an example).
 *
 * @typedef {object} SignalsFactory<SignalsType> - type for monadic signal factories
 * @template SignalsType - specifies the type for signals provided by the factory (type identifiers)
 * @property {FactoryBuild<SignalsType>} build - returns an object with a setup function (taking a store as argument) and the signals being setup
 * @property {FactoryBind<SignalsType>} bind - the monadic bind (aka flatMap) to compose with other signal factories
 * @property {FactoryMap<SignalsType>} fmap - (aka map) the functor map, to map the signals produced by the factory
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

/**
 * A utility function that implements fmap for signal factories. However, instead of using this
 * low-level function, in most cases you should just use the createSignalsFactory utility function.
 *
 * @template SignalsType1 - specifies the signals type for the input factory
 * @template SignalsType2 - specifies the signals type for the resulting factory
 * @param {SignalsFactory<SignalsType1>} factory1 - the input factory
 * @param {function} mapper - the function mapping from Signals<SignalsType1> to Signals<SignalsType2>
 * @returns {SignalsFactory<SignalsType2>} the resulting factory
 */
export const signalsFactoryMap: SignalsFactoryMapCreate = <
  T1 extends SignalIds,
  T2 extends SignalIds,
>(
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

/**
 * A utility function that implements bind for signal factories. However, instead of using this
 * low-level function, in most cases you should just use the createSignalsFactory utility function.
 *
 * @template SignalsType1 - specifies the signals type for the input factory
 * @template SignalsType2 - specifies the signals type for the resulting factory
 * @param {SignalsFactory<SignalsType1>} factory1 - the input factory
 * @param {function} mapper - the function mapping from Signals<SignalsType1> to SignalsFactory<SignalsType2>
 * @returns {SignalsFactory<SignalsType2>} the resulting factory
 */
export const signalsFactoryBind: SignalsFactoryBindCreate = <
  T1 extends SignalIds,
  T2 extends SignalIds,
>(
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
 * This utility function creates an object that implements the SignalsFactory interface. It should be
 * used to implement all specific signal factories (by just extending the returned object as required).
 * See the implementation of EffectSignalsFactory (which is actually a builder) for an example.
 *
 * @template SignalsType - specifies the signals type for the factory
 * @param {function} build - the function that implements build for SignalsFactory<SignalsType>
 * @returns {SignalsFactory<SignalsType>}
 */
export const createSignalsFactory: SignalsFactoryCreate = <T1 extends SignalIds>(
  build: () => Signals<T1>,
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
