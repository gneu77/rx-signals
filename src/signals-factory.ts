/* eslint-disable @typescript-eslint/no-use-before-define */

import { Store } from './store';

interface SetupWithStore {
  readonly setup: (store: Store) => void;
}

interface SignalsTypeWrapper<SignalsType> {
  signals: SignalsType;
}

export type Signals<SignalsType> = SetupWithStore & SignalsTypeWrapper<SignalsType>;

export interface MappedSignalsType<SignalsType1, SignalsType2> {
  readonly signals1: SignalsType1;
  readonly signals2: SignalsType2;
}

/**
 * This is the interface for signal factories, which represent a higher abstraction over the usage
 * of pure behavior and event composition, to encapsulate common patterns of such composition.
 * The interface defines a monadic structure, to allow for simple composition of signal factories.
 * Use the createSignalsFactory utility function to create your own SignalsFactory (see the implementation
 * of EffectSignalsFactory for an example).
 *
 * @typedef {object} SignalsFactory<SignalsType> - interface for monadic signal factories
 * @template SignalsType - specifies the interface for signals provided by the factory (type identifiers)
 * @property {function} build - returns an object with a setup function (taking a store as argument) and the signals being setup
 * @property {function} bind - the monadic bind (aka flatMap) to compose with other signal factories
 * @property {function} fmap - (aka map) a functor to map the signals produced by the factory
 */
export interface SignalsFactory<SignalsType> {
  readonly build: () => Signals<SignalsType>;
  readonly bind: <SignalsType2>(
    mapper: (signals: Signals<SignalsType>) => SignalsFactory<SignalsType2>,
  ) => SignalsFactory<MappedSignalsType<SignalsType, SignalsType2>>;
  readonly fmap: <SignalsType2>(
    mapper: (signals: Signals<SignalsType>) => Signals<SignalsType2>,
  ) => SignalsFactory<SignalsType2>;
}

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
export const signalsFactoryMap = <SignalsType1, SignalsType2>(
  factory1: SignalsFactory<SignalsType1>,
  mapper: (signals: Signals<SignalsType1>) => Signals<SignalsType2>,
): SignalsFactory<SignalsType2> => {
  const newBuild = () => mapper(factory1.build());
  let factory2: SignalsFactory<SignalsType2>;
  const newMap = <SignalsType3>(
    mapper2: (signals: Signals<SignalsType2>) => Signals<SignalsType3>,
  ): SignalsFactory<SignalsType3> => signalsFactoryMap(factory2, mapper2);
  const newBind = <SignalsType3>(
    mapper2: (signals: Signals<SignalsType2>) => SignalsFactory<SignalsType3>,
  ) => signalsFactoryBind(factory2, mapper2);
  factory2 = {
    build: newBuild,
    bind: newBind,
    fmap: newMap,
  };
  return factory2;
};

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
export const signalsFactoryBind = <SignalsType1, SignalsType2>(
  factory1: SignalsFactory<SignalsType1>,
  mapper: (signals: Signals<SignalsType1>) => SignalsFactory<SignalsType2>,
): SignalsFactory<MappedSignalsType<SignalsType1, SignalsType2>> => {
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
  let factory2: SignalsFactory<MappedSignalsType<SignalsType1, SignalsType2>>;
  const newBind = <SignalsType3>(
    mapper2: (
      signals: Signals<MappedSignalsType<SignalsType1, SignalsType2>>,
    ) => SignalsFactory<SignalsType3>,
  ) => signalsFactoryBind(factory2, mapper2);
  const newMap = <SignalsType3>(
    mapper2: (
      signals: Signals<MappedSignalsType<SignalsType1, SignalsType2>>,
    ) => Signals<SignalsType3>,
  ): SignalsFactory<SignalsType3> => signalsFactoryMap(factory2, mapper2);
  factory2 = {
    build: newBuild,
    bind: newBind,
    fmap: newMap,
  };
  return factory2;
};

/**
 * This utility function creates an object that implements the SignalsFactory interface. It should be
 * used to implement all specific signal factories (by just extending the returned object as required).
 * See the implementation of EffectSignalsFactory (which is actually a builder) for an example.
 *
 * @template SignalsType - specifies the signals type for the factory
 * @param {function} build - the function that implements build for SignalsFactory<SignalsType>
 * @returns {SignalsFactory<SignalsType>}
 */
export const createSignalsFactory = <SignalsType>(
  build: () => Signals<SignalsType>,
): SignalsFactory<SignalsType> => {
  let factory: SignalsFactory<SignalsType>;
  const bind = <SignalsType2>(
    mapper: (signals: Signals<SignalsType>) => SignalsFactory<SignalsType2>,
  ) => signalsFactoryBind(factory, mapper);
  const fmap = <SignalsType2>(mapper: (signals: Signals<SignalsType>) => Signals<SignalsType2>) =>
    signalsFactoryMap(factory, mapper);
  factory = {
    build,
    bind,
    fmap,
  };
  return factory;
};
