/* eslint-disable @typescript-eslint/no-use-before-define */
import { Observable } from 'rxjs';
import { Store } from './store';
import {
  BehaviorId,
  getBehaviorId,
  SignalId,
  ToBehaviorIdValueType,
  ToSignalIdValueType,
} from './store-utils';
import { Configuration, merge, Merged, MergedConfiguration, WithValueType } from './type-utils';

/**
 * This type defines an object that maps identifier names to signal ids or nested NameToSignalIds.
 *
 * @typedef {object} NameToSignalId - maps strings on SignalId<any> | NameToSignalId
 */
export type NameToSignalId = { [key: string]: SignalId<any> | NameToSignalId };

/**
 * This type defines an object that holds input and output signal-ids of a Signals type.
 *
 * @template IN - NameToSignalId defining input signals-ids
 * @template OUT - NameToSignalId defining output signals-ids
 * @typedef {object} SignalIds - holds input- and outmput- NameToSignalId objects
 */
export type SignalIds<IN extends NameToSignalId, OUT extends NameToSignalId> = {
  readonly input: IN;
  readonly output: OUT;
};

/**
 * This type defines an object with a function 'setup' that takes a store instance
 * as argument and executes the required setup (wireing) to produce certain signals.
 *
 * @typedef {object} SetupWithStore - has a function setup(store) => void
 */
export type SetupWithStore = {
  readonly setup: (store: Store) => void;
};

/**
 * This type defines an immutable object that encapsulates SignalIds and SetupWithStore.
 * The setup method creates all the necessary wireing to configure the store for the SignalIds.
 * The Signals type represents the reactive counterpart to a class-instance (the IN/OUT-NameToSignalId
 * being the counterpart to a class-interface).
 * SetupWithStore must add sources to the store for all output-ids, but it must NOT any sources for
 * the input-ids.
 *
 * @typedef {object} Signals<IN, OUT> - composition of SetupWithStore and SignalIds<IN, OUT>
 * @template IN - concrete NameToSignalIds defining input signal-ids. SetupWithStore does NOT configure corresponding signals in the store (hence this must be done by the user of this Signals object, e.g. via connect)
 * @template OUT - concrete NameToSignalIds defining output signal-ids. In contrast to the input signal-ids, the SetupWithStore method takes care of setting up corresponding signals in the store.
 */
export type Signals<IN extends NameToSignalId, OUT extends NameToSignalId> = SetupWithStore &
  SignalIds<IN, OUT>;

/**
 * This type defines a function taking some config-object as argument and returning a Signals object.
 * It creates input-, as well as output-ids.
 * It is the reactive counterpart of a class/class-constructor.
 * However, the setup method of the returned Signals only adds signals to the store
 * for the output-ids. For the input-ids, corresponding signals must be setup somewhere else (e.g. via store.connect).
 * If you have a scenario, where setup needs a SignalId that is NOT created by SignalsBuild, then you can pass it via CONFIG.
 *
 * @typedef {function} SignalsBuild<IN, OUT> - constructor argument of SignalsFactories
 * @template IN - concrete NameToSignalIds defining input signal-ids of the resulting Signals object
 * @template OUT - concrete NameToSignalIds defining output signal-ids of the resulting Signals object
 */
export type SignalsBuild<
  IN extends NameToSignalId,
  OUT extends NameToSignalId,
  CONFIG extends Configuration,
> = (config: CONFIG) => Signals<IN, OUT>;

/**
 * This type specifies a function mapping from SignalsBuild<IN1, OUT1, CONFIG1> to a SignalsFactory<IN2, OUT2, CONFIG2>,
 * hence the argument to the monadic-bind method of a SignalsFactor<IN1, OUT1, CONFIG1>.
 *
 * @typedef {function} BindMapper<IN1, OUT1, CONFIG1, IN2, OUT2, CONFIG2> - function mapping from SignalsBuild<IN1, OUT1, CONFIG1> to SignalsFactory<IN2, OUT2, CONFIG2>
 * @template IN1 - concrete NameToSignalIds defining input-ids produced by the given SignalsBuild
 * @template OUT1 - concrete NameToSignalIds defining output-ids produced by the given SignalsBuild
 * @template CONFIG1 - concrete Configuration for the given SignalsBuild
 * @template IN2 - concrete NameToSignalIds defining input signal-ids of the resulting SignalsFactory
 * @template OUT2 - concrete NameToSignalIds defining output signal-ids of the resulting SignalsFactory
 * @template CONFIG2 - concrete Configuration for the resulting SignalsFactory
 */
export type BindMapper<
  IN1 extends NameToSignalId,
  OUT1 extends NameToSignalId,
  CONFIG1 extends Configuration,
  IN2 extends NameToSignalId,
  OUT2 extends NameToSignalId,
  CONFIG2 extends Configuration,
> = (signalsBuild: SignalsBuild<IN1, OUT1, CONFIG1>) => SignalsFactory<IN2, OUT2, CONFIG2>;

/**
 * This type specifies a function mapping from SignalsBuild<IN1, OUT1, CONFIG1> to SignalsBuild<IN2, OUT2, CONFIG2>,
 * hence the argument to the functor-map-method of a SignalsFactor<IN1, OUT1, CONFIG1>.
 *
 * @typedef {function} BuildMapper<IN1, OUT1, CONFIG1, IN2, OUT2, CONFIG2> - function mapping from SignalsBuild<IN1, OUT1, CONFIG1> to SignalsBuild<IN2, OUT2, CONFIG2>
 * @template IN1 - concrete NameToSignalIds defining input signal-ids produced by the given SignalsBuild<IN1, OUT1, CONFIG1>
 * @template OUT1 - concrete NameToSignalIds defining output signal-ids produced by the given SignalsBuild<IN1, OUT1, CONFIG1>
 * @template CONFIG1 - concrete Configuration for the given SignalsBuild<IN1, OUT1, CONFIG1>
 * @template IN2 - concrete NameToSignalIds defining input signals-ids produced by the resulting SignalsBuild<IN2, OUT2, CONFIG2>
 * @template OUT2 - concrete NameToSignalIds defining output signal-ids produced by the resulting SignalsBuild<IN2, OUT2, CONFIG2>
 * @template CONFIG2 - concrete Configuration for the resulting SignalsBuild<IN2, OUT2, CONFIG2>
 */
export type BuildMapper<
  IN1 extends NameToSignalId,
  OUT1 extends NameToSignalId,
  CONFIG1 extends Configuration,
  IN2 extends NameToSignalId,
  OUT2 extends NameToSignalId,
  CONFIG2 extends Configuration,
> = (signalsBuild: SignalsBuild<IN1, OUT1, CONFIG1>) => SignalsBuild<IN2, OUT2, CONFIG2>;

/**
 * This type specifies the result of the SignalsFactory compose method.
 *
 * @typedef {object} ComposedFactory<IN1, OUT1, CONFIG1, IN2, OUT2, CONFIG2> - result of the composition of SignalsFactory<IN1, OUT1, CONFIG1> and SignalsFactory<IN2, OUT2, CONFIG2>
 * @template IN1 - concrete NameToSignalIds defining input signal-ids of a SignalsFactory<IN1, OUT1, CONFIG1>
 * @template OUT1 - concrete NameToSignalIds defining output signal-ids of a SignalsFactory<IN1, OUT1, CONFIG1>
 * @template CONFIG1 - concrete Configuration of a SignalsFactory<IN1, OUT1, CONFIG1>
 * @template IN2 - concrete NameToSignalIds defining input signal-ids of a SignalsFactory<IN2, OUT2, CONFIG2>
 * @template OUT2 - concrete NameToSignalIds defining output signal-ids of a SignalsFactory<IN2, OUT2, CONFIG2>
 * @template CONFIG2 - concrete Configuration of a SignalsFactory<IN2, OUT2, CONFIG2>
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
 * This type specifies the argument to the extendSetup-method of SignalFactories.
 *
 * @typedef {function} ExtendSetup<IN, OUT, CONFIG> - function consuming store, input, output and configuration of a SignalsFactory
 * @template IN - concrete NameToSignalIds defining input signal-ids of a SignalsFactory<IN, OUT, CONFIG>
 * @template OUT - concrete NameToSignalIds defining output signal-ids of a SignalsFactory<IN, OUT, CONFIG>
 * @template CONFIG - concrete Configuration of a SignalsFactory<IN, OUT, CONFIG>
 */
export type ExtendSetup<
  IN extends NameToSignalId,
  OUT extends NameToSignalId,
  CONFIG extends Configuration,
> = (store: Store, input: IN, output: OUT, config: CONFIG) => void;

/**
 * Function mapping from CONFIG1 to CONFIG2
 */
export type MapConfig<CONFIG1 extends Configuration, CONFIG2 extends Configuration> = (
  config: CONFIG2,
) => CONFIG1;

/**
 * Function mapping from one concrete NameToSignalId to another NameToSignalId
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
  N extends keyof T,
  ID extends SignalId<any>,
> = Omit<T, N> & {
  [K in N]: ID;
};

/**
 * RenameId is the result type of renaming a key in a NameToSignalId.
 *
 * @typedef {object} RenameId<T extends NameToSignalId, N1 extends keyof T, N2 extends string> - the result type of { [N1]: T[N1]; } -> { [N2]: T[N1]; }
 * @template T - concrete NameToSignalIds
 * @template N1 - string old key
 * @template N2 - string new key
 */
export type RenameId<T extends NameToSignalId, N1 extends keyof T, N2 extends string> = Omit<
  T,
  N1 | N2
> & {
  [K in N2]: T[N1];
};

/**
 * The SignalsFactory wraps a SignalsBuild<IN, OUT, CONFIG> function, allowing for simple Signals composition
 * and manipulation.
 * Via the compose method, two SignalsFactories can be easily composed to a new one.
 * Several convenience methods simplify re-mapping of IN, OUT and CONFIG.
 * Monadic bind and fmap methods can be used for more complex cases (though 90% of use-cases should be covered by
 * compose, extendSetup, mapInput, mapOutput and mapConfig).
 * SignalsFactory instances are immutable, hence all methods return a new SignalsFactory instance.
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
   * The compose method takes a second SignalsFactory<IN2, OUT2, CONFIG2> and returns a new SignalsFactory
   * that represents the composition of this SignalsFactory and the argument SignalsFactory<IN2, OUT2, CONFIG2>.
   * You can re-map the input, output and configuration of the resulting ComposedFactory<IN, OUT, CONFIG, IN2, OUT2, CONFIG2>
   * by using mapInput, mapOutput and mapConfig correspondingly (as well as the many other convenience methods).
   *
   * @param {SignalsFactory<IN2, OUT2, CONFIG2>} factory2 - a SignalsFactory<IN2, OUT2, CONFIG2>
   * @returns {ComposedFactory<IN, OUT, CONFIG, IN2, OUT2, CONFIG2>} - the SignalsFactory resulting from the composition of SignalsFactory<IN, OUT, CONFIG> and SignalsFactory<IN2, OUT2, CONFIG2>
   */
  compose<IN2 extends NameToSignalId, OUT2 extends NameToSignalId, CONFIG2 extends Configuration>(
    factory2: SignalsFactory<IN2, OUT2, CONFIG2>,
  ): ComposedFactory<IN, OUT, CONFIG, IN2, OUT2, CONFIG2> {
    const build = (config: MergedConfiguration<CONFIG, CONFIG2>) => {
      const s1 = this.build(config?.c1 ?? config);
      const s2 = factory2.build(config?.c2 ?? config);
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
   * This method implements monadic-bind for the SignalsFactory.
   * It takes as argument a pure function that implements SignalsMapToFactory<IN, OUT, CONFIG, IN2, OUT2, CONFIG2>, hence
   * a function taking SignalsBuild<IN, OUT, CONFIG> as argument and returning a SignalsFactory<IN2, OUT2, CONFIG2>.
   * The result of bind is a new SignalsFactory<IN2, OUT2, CONFIG2> that uses the SignalsBuild<IN2, OUT2, CONFIG2>::build
   * of the factory returned from the mapper (hence the result of bind is not the same instance as returned by the mapper).
   *
   * @param {BindMapper<IN, OUT, CONFIG, IN2, OUT2, CONFIG2>} mapper - a pure function mapping from SignalsBuild<IN, OUT, CONFIG> to SignalsFactory<IN2, OUT2, CONFIG2>
   * @returns {SignalsFactory<IN2, OUT2, CONFIG>} - a new SignalsFactory<IN2, OUT2, CONFIG2>
   */
  bind<IN2 extends NameToSignalId, OUT2 extends NameToSignalId, CONFIG2 extends Configuration>(
    mapper: BindMapper<IN, OUT, CONFIG, IN2, OUT2, CONFIG2>,
  ): SignalsFactory<IN2, OUT2, CONFIG2> {
    const newBuild = (config: CONFIG2) => mapper(this.build).build(config);
    return new SignalsFactory<IN2, OUT2, CONFIG2>(newBuild);
  }

  /**
   * This method implements the functor-fmap for the SignalsFactory.
   * It takes as argument a pure function that implements BuildMapper<IN, OUT, CONFIG, IN2, OUT2, CONFIG2>, hence
   * a function taking SignalsBuild<IN, OUT, CONFIG> as argument and returning a SignalsBuild<IN2, OUT2, CONFIG2>.
   * The result of fmap is a new SignalsFactory<IN2, OUT2, CONFIG2> that uses the SignalsBuild<IN2, OUT2, CONFIG2> returned
   * from the mapper.
   *
   * @param {BuildMapper<IN, OUT, CONFIG, IN2, OUT2, CONFIG2>} mapper - a pure function mapping from SignalsBuild<IN, OUT, CONFIG> to SignalsBuild<IN2, OUT2, CONFIG2>
   * @returns {SignalsFactory<IN2, OUT2, CONFIG2>} - a new SignalsFactory<IN2, OUT2, CONFIG2>
   */
  fmap<IN2 extends NameToSignalId, OUT2 extends NameToSignalId, CONFIG2 extends Configuration>(
    mapper: BuildMapper<IN, OUT, CONFIG, IN2, OUT2, CONFIG2>,
  ): SignalsFactory<IN2, OUT2, CONFIG2> {
    const newBuild = (config: CONFIG2) => mapper(this.build)(config);
    return new SignalsFactory<IN2, OUT2, CONFIG2>(newBuild);
  }

  /**
   * The extendSetup method takes as argument a function that implements ExtendSetup<IN, OUT, CONFIG>.
   * It returns a new SignalsFactory of the same type as this SignalsFactory, but with a wrapped SignalsBuild that
   * extends the code executed in the Signals setup method by the provided code.
   *
   * @param {ExtendSetup<IN, OUT, CONFIG>} extend - a function extending the setup method of the Signals produced by the SignalsBuild of the resulting SignalsFactory
   * @returns {SignalsFactory<IN, OUT, CONFIG>} - a new SignalsFactory with extended store setup
   */
  extendSetup(extend: ExtendSetup<IN, OUT, CONFIG>): SignalsFactory<IN, OUT, CONFIG> {
    return this.fmap<IN, OUT, CONFIG>(sb => config => {
      const s = sb(config);
      return {
        ...s,
        setup: (store: Store) => {
          s.setup(store);
          extend(store, s.input, s.output, config);
        },
      };
    });
  }

  /**
   * The connect method offers an easy way to connect an output signal to an input signal.
   * It takes the name of an output-id (a key of OUT) as first argument and the name of an input-id (a key of IN) as second argument.
   * If keepInputId is set to true, it returns a new SignalsFactory of the same type as this SignalsFactory,
   * but with an extended setup logic, that connects the Signal<S extends T> that corresponds to the named output-id to a
   * new Signal<T> corresponding to the named input-id.
   * If keepInputId is set to false, it also extends the setup logic to connect the corresponding signal-ids, but in addition
   * the specified input-id will be excluded from the IN-type of the resulting factory.
   * If the input-id is a BehaviorId, the source being added to the store will be lazily subscribed in the following cases:
   *  - lazy is set to false
   *  - lazy is not set (defaulting to undefined) and the output-id is a BehaviorId
   * (also see store.connect for a more detailed description)
   * Typescript will enforce that both names (keys) map to compatible signal ids, hence if KIN corresponds to SignalId<T>,
   * then KOUT must correspond to SignalId<S extends T> (though one might be an EventId and the other a BehaviorId).
   * That is, even though you only use strings as arguments, this method is still type-safe and will not compile if you try to specify names of non-existing or incompatible ids.
   *
   * @param {KIN} inputName - a key of IN, where IN[toName] must be of type Signal<T>
   * @param {KOUT} outputName - a key of OUT, where OUT[fromName] must be of type Signal<S extends T>
   * @param {boolean} keepInputId - if set to false, the input-id corresponding to toName will be removed from the resulting factories' IN
   * @param {boolean | undefined} lazy - defaults to undefined and is used as lazy-argument to store.connect
   * @returns {SignalsFactory} - a new SignalsFactory with the concrete type depending on the keepInputId argument
   */
  connect<
    KIN extends keyof IN,
    KOUT extends keyof WithValueType<OUT, SignalId<ToSignalIdValueType<IN[KIN]>>>,
    B extends boolean,
  >(
    outputName: KOUT,
    inputName: KIN,
    keepInputId: B,
    lazy: boolean | undefined = undefined,
  ): B extends true ? SignalsFactory<IN, OUT, CONFIG> : SignalsFactory<Omit<IN, KIN>, OUT, CONFIG> {
    const fnew: SignalsFactory<IN, OUT, CONFIG> = this.extendSetup((store, input, output) => {
      const fromId: SignalId<any> = output[outputName] as SignalId<any>;
      const toId: SignalId<any> = input[inputName] as SignalId<any>;
      store.connect(fromId, toId, lazy);
    });
    const result = (keepInputId ? fnew : fnew.removeInputId(inputName)) as B extends true
      ? SignalsFactory<IN, OUT, CONFIG>
      : SignalsFactory<Omit<IN, KIN>, OUT, CONFIG>;
    return result;
  }

  /**
   * The connectId method is a more general version of the connect method. In contrast to connect, it does not take the name
   * of an OUT signal-id, but instead directly a signal-id (thus, some arbitrary signal-id can be used).
   * Everything else works like connect, so please see the corresponding documentation there.
   *
   * @param {KIN} inputName - a key of IN, where IN[toName] must be of type Signal<T>
   * @param {ID} fromId - a Signal<S extends T>
   * @param {boolean} keepInputId - if set to false, the input-id corresponding to toName will be removed from the resulting factories' IN
   * @param {boolean | undefined} lazy - defaults to undefined and is used as lazy-argument to store.connect
   * @returns {SignalsFactory} - a new SignalsFactory with the concrete type depending on the keepInputId argument
   */
  connectId<K extends keyof IN, ID extends SignalId<ToSignalIdValueType<IN[K]>>, B extends boolean>(
    fromId: ID,
    inputName: K,
    keepInputId: B,
    lazy: boolean | undefined = undefined,
  ): B extends true ? SignalsFactory<IN, OUT, CONFIG> : SignalsFactory<Omit<IN, K>, OUT, CONFIG> {
    const fnew: SignalsFactory<IN, OUT, CONFIG> = this.extendSetup((store, input) => {
      const toId: SignalId<any> = input[inputName] as SignalId<any>;
      store.connect(fromId, toId, lazy);
    });
    const result = (keepInputId ? fnew : fnew.removeInputId(inputName)) as B extends true
      ? SignalsFactory<IN, OUT, CONFIG>
      : SignalsFactory<Omit<IN, K>, OUT, CONFIG>;
    return result;
  }

  /**
   * The connectObservable method is even more general compared to the connect and connectId methods. In contrast to the previous two,
   * its first argument is a function that takes store, output and config as arguments and returns an observable.
   * For the other arguments, please see the documentation of the connect method.
   *
   * @param {KIN} inputName - a key of IN, where IN[toName] must be of type Signal<T>
   * @param {function} sourceGetter - a function returning an Observable<S extends T>
   * @param {boolean} keepInputId - if set to false, the input-id corresponding to toName will be removed from the resulting factories' IN
   * @param {boolean | undefined} lazy - defaults to undefined and is used as lazy-argument to store.connect
   * @returns {SignalsFactory} - a new SignalsFactory with the concrete type depending on the keepInputId argument
   */
  connectObservable<
    K extends keyof IN,
    S extends ToSignalIdValueType<IN[K]>,
    O extends Observable<S>,
    B extends boolean,
  >(
    sourceGetter: (store: Store, output: OUT, config: CONFIG) => O,
    inputName: K,
    keepInputId: B,
    lazy: boolean,
  ): B extends true ? SignalsFactory<IN, OUT, CONFIG> : SignalsFactory<Omit<IN, K>, OUT, CONFIG> {
    const fnew: SignalsFactory<IN, OUT, CONFIG> = this.extendSetup((st, ip, op, conf) => {
      const toId: SignalId<any> = ip[inputName] as SignalId<any>;
      st.connectObservable(sourceGetter(st, op, conf), toId, lazy);
    });
    const result = (keepInputId ? fnew : fnew.removeInputId(inputName)) as B extends true
      ? SignalsFactory<IN, OUT, CONFIG>
      : SignalsFactory<Omit<IN, K>, OUT, CONFIG>;
    return result;
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
    return this.fmap<IN2, OUT, CONFIG>(sb => config => {
      const s = sb(config);
      return {
        ...s,
        input: mapper(s.input),
      };
    });
  }

  /**
   * addOrReplaceInputId can be used as a short alternative to mapInput, if you want
   * to add or replace just a single SignalId to/in the input signal ids.
   *
   * @template K - a concrete string to be used as key for the new SignalId
   * @template ID - a concrete SignalId type
   * @param {K} name - the name of the new SignalId
   * @param {() => ID} idGetter - a function returning the new SignalId
   * @returns {SignalsFactory<AddOrReplaceId<IN, K, ID>, OUT, CONFIG>} - a new SignalsFactory with modified input signals
   */
  addOrReplaceInputId<K extends string, ID extends SignalId<any>>(
    name: K,
    idGetter: () => ID,
  ): SignalsFactory<AddOrReplaceId<IN, K, ID>, OUT, CONFIG> {
    return this.mapInput<AddOrReplaceId<IN, K, ID>>(input => ({
      ...input,
      [name]: idGetter(),
    }));
  }

  /**
   * renameInputId can be used as a short alternative to mapInput, if you want
   * to change the name of a single SignalId in the input signal ids.
   *
   * @template K1 - a concrete key of IN
   * @template K2 - the new name for IN[K1]
   * @param {K1} oldName - the old key
   * @param {K2} newName - the new key
   * @returns {SignalsFactory<RenameId<IN, K1, K2>, OUT, CONFIG>} - a new SignalsFactory with modified input signals
   */
  renameInputId<K1 extends keyof IN, K2 extends string>(
    oldName: K1,
    newName: K2,
  ): SignalsFactory<RenameId<IN, K1, K2>, OUT, CONFIG> {
    return this.mapInput<RenameId<IN, K1, K2>>(input => {
      const { [oldName]: mapId, ...rest } = input;
      const result = {
        ...rest,
        [newName]: mapId,
      };
      return result as RenameId<IN, K1, K2>;
    });
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
    return this.fmap<IN, OUT2, CONFIG>(sb => config => {
      const s = sb(config);
      return {
        ...s,
        output: mapper(s.output),
      };
    });
  }

  /**
   * addOrReplaceOutputId can be used as a short alternative to mapOutput, if you want
   * to add or replace just a single SignalId to/in the output signal ids.
   *
   * @template K - a concrete string to be used as key for the new SignalId
   * @template ID - a concrete SignalId type
   * @param {K} name - the name of the new SignalId
   * @param {() => ID} idGetter - a function returning the new SignalId
   * @returns {SignalsFactory<IN, AddOrReplaceId<OUT, K, ID>, CONFIG>} - a new SignalsFactory with modified output signals
   */
  addOrReplaceOutputId<K extends string, ID extends SignalId<any>>(
    name: K,
    idGetter: () => ID,
  ): SignalsFactory<IN, AddOrReplaceId<OUT, K, ID>, CONFIG> {
    return this.mapOutput<AddOrReplaceId<OUT, K, ID>>(output => ({
      ...output,
      [name]: idGetter(),
    }));
  }

  /**
   * renameOutputId can be used as a short alternative to mapOutput, if you want
   * to change the name of a single SignalId in the output signal ids.
   *
   * @template K1 - a concrete key of OUT
   * @template K2 - the new name for OUT[K1]
   * @param {K1} oldName - the old key
   * @param {K2} newName - the new key
   * @returns {SignalsFactory<IN, RenameId<OUT, K1, K2>, CONFIG>} - a new SignalsFactory with modified output signals
   */
  renameOutputId<K1 extends keyof OUT, K2 extends string>(
    oldName: K1,
    newName: K2,
  ): SignalsFactory<IN, RenameId<OUT, K1, K2>, CONFIG> {
    return this.mapOutput<RenameId<OUT, K1, K2>>(output => {
      const { [oldName]: mapId, ...rest } = output;
      const result = {
        ...rest,
        [newName]: mapId,
      };
      return result as RenameId<OUT, K1, K2>;
    });
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

  /**
   * mapOutputBehavior can be used to transfrom an output-behavior of type TOLD to a new behavior of type TNEW,
   * keeping the output-id-name. Thus, this is a short form for adding a new behavior based on an existing
   * output-behavior, then removing the ID of the existing one from output and finally, putting the ID of the
   * new behavior into output under the removed name of the existing behavior.
   * Hence, this transforms from SignalsFactory<IN, OUT, CONFIG> to SignalsFactory<IN, OUT2, CONFIG>
   * with OUT2 having the same keys as OUT, but OUT2[KOUT] having type TNEW and OUT[KOUT] having type TOLD
   *
   * @template KOUT - a concrete output key mapping to a BehaviorId<any>
   * @template TNEW - value-type of the OUT2[KOUT] BehaviorId after mapping
   * @param {KOUT} outputName - the name of a BehaviorId<any> from OUT
   * @param {function} mapper - a function returning Observable<TNEW>
   * @returns {SignalsFactory<IN, AddOrReplaceId<OUT, KOUT, BehaviorId<TNEW>>, CONFIG>} - a new SignalsFactory with a modified output signal
   */
  mapOutputBehavior<TNEW, KOUT extends keyof WithValueType<OUT, BehaviorId<any>>>(
    outputName: KOUT,
    mapper: (
      old: Observable<ToBehaviorIdValueType<OUT[KOUT]>>,
      store: Store,
      input: IN,
      output: OUT,
      config: CONFIG,
    ) => Observable<TNEW>,
  ): SignalsFactory<IN, AddOrReplaceId<OUT, KOUT, BehaviorId<TNEW>>, CONFIG> {
    return this.fmap<IN, AddOrReplaceId<OUT, KOUT, BehaviorId<TNEW>>, CONFIG>(sb => config => {
      const s = sb(config);
      const newId = getBehaviorId<TNEW>();
      const oldId = s.output[outputName] as BehaviorId<ToBehaviorIdValueType<OUT[KOUT]>>;
      return {
        ...s,
        setup: store => {
          store.addDerivedState(
            newId,
            mapper(store.getBehavior(oldId), store, s.input, s.output, config),
          );
          s.setup(store);
        },
        output: {
          ...s.output,
          [outputName]: newId,
        },
      };
    });
  }
}
