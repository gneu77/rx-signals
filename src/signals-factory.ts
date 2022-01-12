/* eslint-disable @typescript-eslint/no-use-before-define */
import { Store } from './store';
import { TypeIdentifier } from './store.utils';

/**
 * This type defines an object that maps identifier names on type identifiers.
 *
 * @typedef {object} SignalIds - maps strings on TypeIdentifier<any> | SignalIds
 */
export type SignalIds = Readonly<{ [key: string]: TypeIdentifier<any> | SignalIds }>;

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
 * This type defines a wrapper object that has a field 'ids' mapping to a SignalIds object.
 *
 * @typedef {object} SignalTypes<T extends SignalIds> - wrapper for a SignalsIds object
 * @template T - a concrete SignalIds type, specifying the signal identifiers (so an object with TypeIdentifier<T> as values)
 */
export type SignalTypes<T extends SignalIds> = {
  readonly ids: T;
};

/**
 * In contrast to SignalTypes, this type defines a wrapper object that has two fields 'ids1'
 * and 'ids2' mapping to SignalIds objects. It is the default SignalTypes object of a
 * SignalsFactory resulting from a SignalsFactory.bind().
 * So 'ids1' is the SignalsTypes object of the first SignalsFactory and 'ids2' is the
 * SignalsTypes of the bound SignalsFactory.
 *
 * @typedef {object} MappedSignalTypes<T1 extends SignalIds, T2 extends SignalIds> - wrapper for signal types of a SignalsFactory resulting from a bind()
 * @template T1 - a concrete SignalIds type, specifying the signal identifiers of the initial SignalsFactory
 * @template T2 - a concrete SignalIds type, specifying the signal identifiers of the SignalsFactory that was used as argument to SignalsFactory.bind()
 */
export type MappedSignalTypes<T1 extends SignalIds, T2 extends SignalIds> = Readonly<{
  ids1: T1;
  ids2: T2;
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
 * This type specifies a function mapping from SignalIds T1 to SignalIds T2.
 *
 * @typedef {function} IdsMapper<T1 extends SignalIds, T2 extends SignalIds> - function mapping from T1 to T2
 * @template T1 - the concrete SignalIds type of the initial SignalsFactory
 * @template T2 - the concrete SignalIds type of the resulting SignalsFactory
 */
export type IdsMapper<T1 extends SignalIds, T2 extends SignalIds> = (ids: T1) => T2;

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
 * This type defines a function mapping from one SignalsFactory to a new SignalsFactory that works
 * like the original one, just that the SignalsIds object is changed (e.g. renamed identifiers
 * or less identifiers being exposed, etc.).
 *
 * @typedef {function} FactoryIdsMap<T1> - type for the idsMap method of SignalsFactories
 * @template T1 - the concrete SignalIds provided by the implementing SignalsFactory
 * @template T2 - the concrete SignalIds provided by the resulting SignalsFactory
 * @property {IdsMapper<T1, T2>} mapper
 */
export type FactoryIdsMap<T1 extends SignalIds> = <T2 extends SignalIds>(
  mapper: IdsMapper<T1, T2>,
) => SignalsFactory<T2>;

/**
 * This type defines a function mapping from a composed SignalsFactory<T>
 * to a SignalsFactory<FlattenComposedIds<T>>.
 * If T is MappedSignalTypes<T1, T2>, then the new Ids will be flattened,
 * else the Ids type will just not be changed.
 *
 * @typedef {function} FactoryFlattenIds<T> - type for the flattenIds method of SignalsFactories
 * @template T - the concrete SignalIds provided by the implementing SignalsFactory
 */
export type FactoryFlattenIds<T extends SignalIds> = () => SignalsFactory<FlattenComposedIds<T>>;

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
 * @property {FactoryIdsMap<T>} idsMap - to map the T to a T2
 * @property {FactoryFlattenIds<T>} flattenIds - to map the T to FlattenComposedIds<T> (due to current TS-limitations, you must call this multiple times to also flatten nested MappedSignalTypes)
 */
export type SignalsFactory<T extends SignalIds> = Readonly<{
  build: FactoryBuild<T>;
  bind: FactoryBind<T>;
  fmap: FactoryMap<T>;
  idsMap: FactoryIdsMap<T>;
  flattenIds: FactoryFlattenIds<T>;
}>;

type SignalsFactoryMapCreate = <T1 extends SignalIds, T2 extends SignalIds>(
  factory1: SignalsFactory<T1>,
  mapper: (signals: Signals<T1>) => Signals<T2>,
) => SignalsFactory<T2>;

type SignalsFactoryIdsMapCreate = <T1 extends SignalIds, T2 extends SignalIds>(
  factory1: SignalsFactory<T1>,
  mapper: (signals: T1) => T2,
) => SignalsFactory<T2>;

type SignalsFactoryFlattenIdsCreate = <T extends SignalIds>(
  factory: SignalsFactory<T>,
) => SignalsFactory<FlattenComposedIds<T>>;

const signalsFactoryFlattenComposedIds: SignalsFactoryFlattenIdsCreate = <T extends SignalIds>(
  factory: SignalsFactory<T>,
): SignalsFactory<FlattenComposedIds<T>> =>
  signalsFactoryIdsMap(factory, (ids: T) => flattenSignalIds(ids));

const signalsFactoryIdsMap: SignalsFactoryIdsMapCreate = <
  T1 extends SignalIds,
  T2 extends SignalIds,
>(
  factory1: SignalsFactory<T1>,
  mapper: IdsMapper<T1, T2>,
): SignalsFactory<T2> => {
  const fmapper: SignalsMapper<T1, T2> = s => ({
    ids: mapper(s.ids),
    setup: s.setup,
  });
  const build = () => fmapper(factory1.build());
  let factory2: SignalsFactory<T2>;
  const fmap = <T3 extends SignalIds>(mapper2: SignalsMapper<T2, T3>): SignalsFactory<T3> =>
    signalsFactoryMap(factory2, mapper2);
  const idsMap = <T3 extends SignalIds>(mapper2: IdsMapper<T2, T3>): SignalsFactory<T3> =>
    signalsFactoryIdsMap(factory2, mapper2);
  const bind = <T3 extends SignalIds>(mapper2: SignalsMapToFactory<T2, T3>) =>
    signalsFactoryBind(factory2, mapper2);
  const flattenIds = () => signalsFactoryFlattenComposedIds(factory2);
  factory2 = {
    build,
    bind,
    fmap,
    idsMap,
    flattenIds,
  };
  return factory2;
};

const signalsFactoryMap: SignalsFactoryMapCreate = <T1 extends SignalIds, T2 extends SignalIds>(
  factory1: SignalsFactory<T1>,
  mapper: SignalsMapper<T1, T2>,
): SignalsFactory<T2> => {
  const build = () => mapper(factory1.build());
  let factory2: SignalsFactory<T2>;
  const fmap = <T3 extends SignalIds>(mapper2: SignalsMapper<T2, T3>): SignalsFactory<T3> =>
    signalsFactoryMap(factory2, mapper2);
  const idsMap = <T3 extends SignalIds>(mapper2: IdsMapper<T2, T3>): SignalsFactory<T3> =>
    signalsFactoryIdsMap(factory2, mapper2);
  const bind = <T3 extends SignalIds>(mapper2: SignalsMapToFactory<T2, T3>) =>
    signalsFactoryBind(factory2, mapper2);
  const flattenIds = () => signalsFactoryFlattenComposedIds(factory2);
  factory2 = {
    build,
    bind,
    fmap,
    idsMap,
    flattenIds,
  };
  return factory2;
};

// Some helper types for FlattenComposedIds
// This is more like a workaround, because shorter and/or more general and/or recursive
// versions always end up with TypeScript complaining about too complex types.
// (Type instantiation is excessively deep and possibly infinite.ts(2589))
// Maybe in future TypeScript versions, I can come up with something better:
type NoConflictKeys1<Parent, Child> = {
  [CK in keyof Child]: CK extends keyof Parent ? never : CK;
}[keyof Child];
type ConflictKeys1<Parent, Child> = {
  [CK in keyof Child]: CK extends keyof Parent ? CK : never;
}[string & keyof Child];
type NoConflict1<Parent, Child> = {
  [CK in NoConflictKeys1<Parent, Child>]: Child[CK];
};
type Conflict1<Parent, Child> = {
  [CK in ConflictKeys1<Parent, Child> as `${CK}_1`]: Child[CK];
};
type MappedChild1<Parent extends SignalIds, Child extends SignalIds> = NoConflict1<Parent, Child> &
  Conflict1<Parent, Child>;
type NoConflictKeys2<Parent, Ids1Child, Child> = {
  [CK in keyof Child]: CK extends keyof Parent | keyof Ids1Child ? never : CK;
}[keyof Child];
type ConflictKeys2<Parent, Ids1Child, Child> = {
  [CK in keyof Child]: CK extends keyof Parent | keyof Ids1Child ? CK : never;
}[string & keyof Child];
type NoConflict2<Parent, Ids1Child, Child> = {
  [CK in NoConflictKeys2<Parent, Ids1Child, Child>]: Child[CK];
};
type Conflict2<Parent, Ids1Child, Child> = {
  [CK in ConflictKeys2<Parent, Ids1Child, Child> as `${CK}_2`]: Child[CK];
};
type MappedChild2<Parent extends SignalIds, Ids1Child, Child> = NoConflict2<
  Parent,
  Ids1Child,
  Child
> &
  Conflict2<Parent, Ids1Child, Child>;
type Ids1Flat<T extends SignalIds> = T extends { ids1: SignalIds }
  ? MappedChild1<Omit<T, 'ids1' | 'ids2'>, T['ids1']>
  : {};
type Ids2Flat<T extends SignalIds> = T extends { ids1: SignalIds; ids2: SignalIds }
  ? MappedChild2<Omit<T, 'ids1' | 'ids2'>, T['ids1'], T['ids2']>
  : {};

/**
 * When binding two SignalsFactories with SignalIds T1 and T2, the resulting SignalIds are of
 * type MappedSignalTypes<T1, T2>.
 * The FlattenComposedIds<T extends SignalIds> type constructor maps T to T in case that T does
 * not extend { ids1: SignalIds; ids2: SignalIds }. Otherwise, it will spread the ids1 and ids2
 * content (lifting the underlying properties one level up). Conflicting property names will be modified.
 * E.g. the following type:
 * {
 *    a: TypeIdentifier<number>;
 *    ids1: {
 *        a: TypeIdentifier<string>;
 *        b: TypeIdentifier<string>;
 *    };
 *    ids2: {
 *        a: TypeIdentifier<boolean>;
 *        b: TypeIdentifier<boolean>;
 *        c: TypeIdentifier<boolean>;
 *    };
 * };
 * will be mapped to:
 * {
 *    a: TypeIdentifier<number>;
 *    a_1: TypeIdentifier<string>;
 *    b: TypeIdentifier<string>;
 *    a_2: TypeIdentifier<boolean>;
 *    b_2: TypeIdentifier<boolean>;
 *    c: TypeIdentifier<boolean>;
 * };
 * hence, conflicting properties will be appended by '_1' in case they come from 'ids1', or
 * by '_2' in case they come from 'ids2'.
 *
 * @typedef {object} FlattenComposedIds<T extends SignalIds> - flattens (nested) MappedSignalTypes
 * @template T - a concrete SignalIds type
 */
export type FlattenComposedIds<T extends SignalIds> = Omit<T, 'ids1' | 'ids2'> &
  Ids1Flat<T> &
  Ids2Flat<T>;

type Writeable<T> = { -readonly [P in keyof T]: T[P] };
const flattenIdsImpl = <T extends SignalIds>(ids: T): Writeable<SignalIds> => {
  if (ids.ids1 && ids.ids2) {
    const result: Writeable<SignalIds> = { ...ids };
    const { ids1, ids2 } = result;
    delete result.ids1;
    delete result.ids2;
    Object.entries(ids1).forEach(([k, v]) => {
      let kNew = k;
      while (result[kNew]) {
        kNew += '_1';
      }
      result[kNew] = v;
    });
    Object.entries(ids2).forEach(([k, v]) => {
      let kNew = k;
      while (result[kNew]) {
        kNew += '_2';
      }
      result[kNew] = v;
    });
    // A recursive implementation is trivial, but calculating its corresponding result
    // type recursilvely, as of TS 4.4.4, results in:
    //    'Type instantiation is excessively deep and possibly infinite.ts(2589)'
    // Maybe future TS versions can handle complex type definitions more efficiently
    // return flattenIdsImpl(result);
    return result;
  }
  return ids;
};

const flattenSignalIds = <T extends SignalIds>(ids: T): FlattenComposedIds<T> =>
  flattenIdsImpl(ids) as unknown as FlattenComposedIds<T>;

type SignalsFactoryBindCreate = <T1 extends SignalIds, T2 extends SignalIds>(
  factory1: SignalsFactory<T1>,
  mapper: SignalsMapToFactory<T1, T2>,
) => SignalsFactory<MappedSignalTypes<T1, T2>>;

const signalsFactoryBind: SignalsFactoryBindCreate = <T1 extends SignalIds, T2 extends SignalIds>(
  factory1: SignalsFactory<T1>,
  mapper: SignalsMapToFactory<T1, T2>,
): SignalsFactory<MappedSignalTypes<T1, T2>> => {
  const build = () => {
    const s1 = factory1.build();
    const factory2 = mapper(s1);
    const s2 = factory2.build();
    return {
      setup: (store: Store) => {
        s1.setup(store);
        s2.setup(store);
      },
      ids: {
        ids1: s1.ids,
        ids2: s2.ids,
      },
    };
  };
  let factory2: SignalsFactory<MappedSignalTypes<T1, T2>>;
  const bind = <T3 extends SignalIds>(
    mapper2: SignalsMapToFactory<MappedSignalTypes<T1, T2>, T3>,
  ) => signalsFactoryBind(factory2, mapper2);
  const fmap = <T3 extends SignalIds>(
    mapper2: SignalsMapper<MappedSignalTypes<T1, T2>, T3>,
  ): SignalsFactory<T3> => signalsFactoryMap(factory2, mapper2);
  const idsMap = <T3 extends SignalIds>(
    mapper2: IdsMapper<MappedSignalTypes<T1, T2>, T3>,
  ): SignalsFactory<T3> => signalsFactoryIdsMap(factory2, mapper2);
  const flattenIds = () => signalsFactoryFlattenComposedIds(factory2);
  factory2 = {
    build,
    bind,
    fmap,
    idsMap,
    flattenIds,
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
  const idsMap = <T2 extends SignalIds>(mapper: IdsMapper<T1, T2>) =>
    signalsFactoryIdsMap(factory, mapper);
  const flattenIds = () => signalsFactoryFlattenComposedIds(factory);
  factory = {
    build,
    bind,
    fmap,
    idsMap,
    flattenIds,
  };
  return factory;
};
