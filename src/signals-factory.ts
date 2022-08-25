/* eslint-disable @typescript-eslint/no-use-before-define */
import { Observable, take } from 'rxjs';
import { Store } from './store';
import {
  BehaviorId,
  DerivedId,
  EffectId,
  getDerivedId,
  SignalId,
  ToBehaviorIdValueType,
  ToSignalIdValueType,
} from './store-utils';
import {
  Configuration,
  KeysOfValueType,
  merge,
  Merged,
  MergedConfiguration,
  WithValueType,
} from './type-utils';

/**
 * This type defines an object that maps identifier names to {@link SignalId}s or nested {@link NameToSignalId}s.
 */
export type NameToSignalId = { [key: string]: SignalId<any> | NameToSignalId };

/**
 * This type defines an object that maps identifier names to {@link EffectId}s or nested {@link NameToEffectId}s.
 */
export type NameToEffectId = { [key: string]: EffectId<any, any> | NameToEffectId };

/**
 * This type defines an object that holds input and output {@link SignalId}s of a {@link Signals} type.
 *
 * @template IN - {@link NameToSignalId} defining input signals-ids
 * @template OUT - {@link NameToSignalId} defining output signals-ids
 */
export type SignalIds<IN extends NameToSignalId, OUT extends NameToSignalId> = {
  readonly input: IN;
  readonly output: OUT;
};

/**
 * This type defines an object that holds {@link EffectId}s of a {@link Signals} type.
 *
 * @template EFF - {@link NameToEffectId} defining effect-ids
 */
export type EffectIds<EFF extends NameToEffectId> = {
  readonly effects: EFF;
};

/**
 * This type defines an object with a function 'setup' that takes a {@link Store} instance
 * as argument and executes the required setup (wireing) to produce certain output signals.
 */
export type SetupWithStore = {
  readonly setup: (store: Store) => void;
};

/**
 * This type defines an immutable object that encapsulates {@link SignalIds}, {@link SetupWithStore} and {@link EffectIds}.
 * The setup method creates all the necessary wireing to configure the {@link Store} instance for the SignalIds.
 * The Signals type represents the reactive counterpart to a class-instance (the IN/OUT-{@link NameToSignalId}
 * being the counterpart to a class-interface).
 * SetupWithStore must add sources to the store for all output-ids, but it must NOT add sources for
 * the input-ids and it must also NOT add effects for the effect-ids.
 *
 * @template IN - concrete {@link NameToSignalId} defining input signal-ids. SetupWithStore does NOT add corresponding signals to the store (hence this must be done by the user of this Signals object, e.g. via connect)
 * @template OUT - concrete {@link NameToSignalId} defining output signal-ids. In contrast to the input signal-ids, the SetupWithStore method takes care of setting up corresponding signals in the store.
 * @template EFF - concrete {@link NameToEffectId} defining effect-ids. SetupWithStore does NOT add corresponding effects to the store (hence this must be done by the user of this Signals object)
 */
export type Signals<
  IN extends NameToSignalId,
  OUT extends NameToSignalId,
  EFF extends NameToEffectId = {},
> = SetupWithStore & SignalIds<IN, OUT> & EffectIds<EFF>;

/**
 * This type defines a function taking some config-object as argument and returning a {@link Signals} object, hence the type being used as constructor argument for {@link SignalsFactory}.
 * It creates input- and output-ids, as well as effect-ids.
 * It is the reactive counterpart of a class/class-constructor.
 * However, the setup method of the returned Signals only adds signals to the store
 * for the output-ids. For the input-ids, corresponding signals must be setup somewhere else (e.g. via store.connect).
 * If you have a scenario, where setup needs a {@link SignalId} that is NOT created by {@link SignalsBuild}, then you can pass it via CONFIG.
 * The same holds true for effects (no effects for the generated effect-ids will be added to the store).
 * (see {@link SignalsFactory.useExistingEffect} on how to delegate from a generated effect-id to an existing effect)
 *
 * @template IN - concrete {@link NameToSignalId} defining input signal-ids of the resulting Signals object
 * @template OUT - concrete {@link NameToSignalId} defining output signal-ids of the resulting Signals object
 * @template CONFIG - concrete {@link Configuration} for the given SignalsBuild
 * @template EFF - concrete {@link NameToEffectId} defining effect-ids of the resulting Signals object
 */
export type SignalsBuild<
  IN extends NameToSignalId,
  OUT extends NameToSignalId,
  CONFIG extends Configuration,
  EFF extends NameToEffectId,
> = (config: CONFIG) => Signals<IN, OUT, EFF>;

/**
 * This type specifies a function mapping from ```SignalsBuild<IN1, OUT1, CONFIG1, EFF1>``` to ```SignalsFactory<IN2, OUT2, CONFIG2, EFF2>```,
 * hence the argument to the monadic-bind method of a {@link SignalsFactory}.
 *
 * @template IN1 - concrete {@link NameToSignalId} defining input-ids produced by the given SignalsBuild
 * @template OUT1 - concrete {@link NameToSignalId} defining output-ids produced by the given SignalsBuild
 * @template CONFIG1 - concrete {@link Configuration} for the given SignalsBuild
 * @template EFF1 - concrete {@link NameToEffectId} defining effect-ids produced by the given SignalsBuild
 * @template IN2 - concrete {@link NameToSignalId} defining input signal-ids of the resulting SignalsFactory
 * @template OUT2 - concrete {@link NameToSignalId} defining output signal-ids of the resulting SignalsFactory
 * @template CONFIG2 - concrete {@link Configuration} for the resulting SignalsFactory
 * @template EFF2 - concrete {@link NameToEffectId} defining effect-ids of the resulting SignalsFactory
 */
export type BindMapper<
  IN1 extends NameToSignalId,
  OUT1 extends NameToSignalId,
  CONFIG1 extends Configuration,
  EFF1 extends NameToEffectId,
  IN2 extends NameToSignalId,
  OUT2 extends NameToSignalId,
  CONFIG2 extends Configuration,
  EFF2 extends NameToEffectId,
> = (
  signalsBuild: SignalsBuild<IN1, OUT1, CONFIG1, EFF1>,
) => SignalsFactory<IN2, OUT2, CONFIG2, EFF2>;

/**
 * This type specifies a function mapping from ```SignalsBuild<IN1, OUT1, CONFIG1, EFF1>``` to ```SignalsBuild<IN2, OUT2, CONFIG2, EFF2>```,
 * hence the argument to the functor-map-method of a {@link SignalsFactory}.
 *
 * @template IN1 - concrete {@link NameToSignalId} defining input signal-ids produced by the given SignalsBuild
 * @template OUT1 - concrete {@link NameToSignalId} defining output signal-ids produced by the given SignalsBuild
 * @template CONFIG1 - concrete {@link Configuration} for the given SignalsBuild
 * @template EFF1 - concrete {@link NameToEffectId} produced by the given SignalsBuild
 * @template IN2 - concrete {@link NameToSignalId} defining input signals-ids produced by the resulting SignalsBuild
 * @template OUT2 - concrete {@link NameToSignalId} defining output signal-ids produced by the resulting SignalsBuild
 * @template CONFIG2 - concrete {@link Configuration} for the resulting SignalsBuild
 * @template EFF2 - concrete {@link NameToEffectId} produced by the resulting SignalsBuild
 */
export type BuildMapper<
  IN1 extends NameToSignalId,
  OUT1 extends NameToSignalId,
  CONFIG1 extends Configuration,
  EFF1 extends NameToEffectId,
  IN2 extends NameToSignalId,
  OUT2 extends NameToSignalId,
  CONFIG2 extends Configuration,
  EFF2 extends NameToEffectId,
> = (
  signalsBuild: SignalsBuild<IN1, OUT1, CONFIG1, EFF1>,
) => SignalsBuild<IN2, OUT2, CONFIG2, EFF2>;

/**
 * This type specifies the result of the {@link SignalsFactory.compose} method.
 *
 * @template IN1 - concrete {@link NameToSignalId} defining input signal-ids of SignalsFactory1
 * @template OUT1 - concrete {@link NameToSignalId} defining output signal-ids of SignalsFactory1
 * @template CONFIG1 - concrete {@link Configuration} of SignalsFactory1
 * @template EFF1 - concrete {@link NameToEffectId} of SignalsFactory1
 * @template IN2 - concrete {@link NameToSignalId} defining input signal-ids of SignalsFactory2
 * @template OUT2 - concrete {@link NameToSignalId} defining output signal-ids of SignalsFactory2
 * @template CONFIG2 - concrete {@link Configuration} of SignalsFactory2
 * @template EFF1 - concrete {@link NameToEffectId} of SignalsFactory2
 */
export type ComposedFactory<
  IN1 extends NameToSignalId,
  OUT1 extends NameToSignalId,
  CONFIG1 extends Configuration,
  EFF1 extends NameToEffectId,
  IN2 extends NameToSignalId,
  OUT2 extends NameToSignalId,
  CONFIG2 extends Configuration,
  EFF2 extends NameToEffectId,
> = SignalsFactory<
  Merged<IN1, IN2>,
  Merged<OUT1, OUT2>,
  MergedConfiguration<CONFIG1, CONFIG2>,
  Merged<EFF1, EFF2>
>;

/**
 * This type specifies the argument to the {@link SignalsFactory.extendSetup} method.
 *
 * @template IN - concrete {@link NameToSignalId} defining input signal-ids of a SignalsFactory
 * @template OUT - concrete {@link NameToSignalId} defining output signal-ids of a SignalsFactory
 * @template CONFIG - concrete {@link Configuration} of a SignalsFactory
 * @template EFF - concrete {@link NameToEffectId} of a SignalsFactory
 */
export type ExtendSetup<
  IN extends NameToSignalId,
  OUT extends NameToSignalId,
  CONFIG extends Configuration,
  EFF extends NameToEffectId,
> = (store: Store, input: IN, output: OUT, config: CONFIG, effects: EFF) => void;

/**
 * Function mapping from CONFIG1 to CONFIG2
 */
export type MapConfig<CONFIG1 extends Configuration, CONFIG2 extends Configuration> = (
  config: CONFIG2,
) => CONFIG1;

/**
 * Function mapping from one concrete {@link NameToSignalId} to another {@link NameToSignalId}
 */
export type MapSignalIds<T1 extends NameToSignalId, T2 extends NameToSignalId, CONFIG> = (
  ids: T1,
  config: CONFIG,
) => T2;

/**
 * Function mapping from one concrete {@link NameToEffectId} to another {@link NameToEffectId}
 */
export type MapEffectIds<T1 extends NameToEffectId, T2 extends NameToEffectId, CONFIG> = (
  ids: T1,
  config: CONFIG,
) => T2;

/**
 * AddSignalId is the result type of adding a key in a {@link NameToSignalId} (also see the difference to {@link AddOrReplaceId}).
 *
 * ```ts
 * AddSignalId<{ a: EventId<number> }, 'a', EventId<string> -> { a: EventId<never> }
 * AddSignalId<{ a: EventId<number> }, 'b', EventId<string> -> { a: EventId<number>; b: EventId<string> }
 * ```
 *
 * @template T - concrete NameToSignalIds
 * @template N - string key
 * @template ID - concrete SignalId
 */
export type AddSignalId<
  T extends NameToSignalId,
  N extends keyof T,
  ID extends SignalId<any>,
> = T & {
  [K in N]: ID;
};

/**
 * AddOrReplaceId is the result type of adding or replacing a key in a {@link NameToSignalId}.
 *
 * ```ts
 * AddOrReplaceId<{ a: EventId<number> }, 'a', EventId<string> -> { a: EventId<string> }
 * AddOrReplaceId<{ a: EventId<number> }, 'b', EventId<string> -> { a: EventId<number>; b: EventId<string> }
 * ```
 *
 * @typedef {object} AddOrReplaceId
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
 * AddEffectId is the result type of adding a key in a {@link NameToEffectId}.
 *
 * ```ts
 * AddEffectId<{ a: EffectId<number, string> }, N, ID> -> { a: EffectId<number, string>; [N]: ID }
 * ```
 *
 * @typedef {object} AddEffectId
 * @template T - concrete NameToEffectIds
 * @template N - string key
 * @template ID - concrete EffectId
 */
export type AddEffectId<
  T extends NameToEffectId,
  N extends keyof T,
  ID extends EffectId<any, any>,
> = T & {
  [K in N]: ID;
};

/**
 * RenameId is the result type of renaming a key in a {@link NameToSignalId}.
 *
 * ```ts
 * RenameId<{ [N1]: T[N1] }> -> { [N2]: T[N1] }
 * ```
 *
 * @typedef {object} RenameId
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
 * RenameEffectId is the result type of renaming a key in a {@link NameToEffectId}.
 *
 * ```ts
 * RenameEffectId<{ [N1]: T[N1] }, N1, N2> -> { [N2]: T[N1] }
 * ```
 *
 * @typedef {object} RenameEffectId
 * @template T - concrete NameToEffectIds
 * @template N1 - string old key
 * @template N2 - string new key
 */
export type RenameEffectId<T extends NameToEffectId, N1 extends keyof T, N2 extends string> = Omit<
  T,
  N1 | N2
> & {
  [K in N2]: T[N1];
};

/**
 * AssertNonExistingKey is a helper type that returns K, if K does not extend keyof T.
 * If K does extend keyof T (K is a key of the object T), then never | Message will be the result type.
 * The latter would result in a TS-error, if a function expects an argument as AssertNonExistingKey\<K, T, M\>, saying "argument of type \<K\> is not assignable to parameter of type \<Message\>"
 *
 * @typedef {object} AssertNonExistingKey - evaluates to K only if K is not in keyof T, else gives compile-time error including Message
 * @template K - string
 * @template T - object with string keys
 * @template Message - message to be used in assertion
 */
export type AssertNonExistingKey<
  K extends string,
  T extends { [key: string]: any },
  Message extends string,
> = (K & (K extends keyof T ? never : K)) | Message;

/**
 * A SignalsFactory wraps a {@link SignalsBuild} function, allowing for simple {@link Signals} composition
 * and manipulation.
 * Via the compose method, two SignalsFactories can be easily composed to a new one.
 * Several convenience methods simplify re-mapping of IN, OUT, CONFIG and EFF.
 * Monadic bind and fmap methods can be used for more complex cases (though 90% of use-cases should be covered by
 * compose, extendSetup, mapInput, mapOutput and mapConfig).
 * SignalsFactory instances are immutable (persistent data structures), hence all methods return a new SignalsFactory instance.
 * (The whole purpose of this class is to provide immutable SignalsBuild composition)
 *
 * @class SignalsFactory
 */
export class SignalsFactory<
  IN extends NameToSignalId,
  OUT extends NameToSignalId,
  CONFIG extends Configuration = {},
  EFF extends NameToEffectId = {},
> {
  /**
   * The constructor takes a pure function implementing SignalsBuild.
   *
   * @param {SignalsBuild<IN, OUT, CONFIG, EFF>} build - a pure function mapping from CONFIG to Signals
   * @constructor
   */
  constructor(readonly build: SignalsBuild<IN, OUT, CONFIG, EFF>) {}

  /**
   * The compose method takes a second SignalsFactory2 and returns a new SignalsFactory
   * that represents the composition of this SignalsFactory and the argument SignalsFactory2.
   * You can re-map the input, output, configuration and effects of the resulting composed SignalsFactory
   * by using mapInput, mapOutput, mapConfig and mapEffects correspondingly (as well as the many other convenience methods).
   *
   * @param {SignalsFactory} factory2 - a SignalsFactory
   * @returns {SignalsFactory} - the SignalsFactory resulting from the composition of this SignalsFactory and SignalsFactory2
   */
  compose<
    IN2 extends NameToSignalId,
    OUT2 extends NameToSignalId,
    CONFIG2 extends Configuration,
    EFF2 extends NameToEffectId,
  >(
    factory2: SignalsFactory<IN2, OUT2, CONFIG2, EFF2>,
  ): ComposedFactory<IN, OUT, CONFIG, EFF, IN2, OUT2, CONFIG2, EFF2> {
    const build: SignalsBuild<
      Merged<IN, IN2>,
      Merged<OUT, OUT2>,
      MergedConfiguration<CONFIG, CONFIG2>,
      Merged<EFF, EFF2>
    > = (config: MergedConfiguration<CONFIG, CONFIG2>) => {
      const s1 = this.build(config?.c1 ?? config);
      const s2 = factory2.build(config?.c2 ?? config);
      return {
        setup: (store: Store) => {
          s1.setup(store);
          s2.setup(store);
        },
        input: merge(s1.input, s2.input),
        output: merge(s1.output, s2.output),
        effects: merge(s1.effects, s2.effects),
      };
    };
    return new SignalsFactory<
      Merged<IN, IN2>,
      Merged<OUT, OUT2>,
      MergedConfiguration<CONFIG, CONFIG2>,
      Merged<EFF, EFF2>
    >(build);
  }

  /**
   * This method implements monadic-bind for the SignalsFactory.
   * It takes as argument a pure function that implements SignalsMapToFactory\<IN, OUT, CONFIG, EFF, IN2, OUT2, CONFIG2, EFF2\>, hence
   * a function taking SignalsBuild\<IN, OUT, CONFIG, EFF\> as argument and returning a SignalsFactory\<IN2, OUT2, CONFIG2, EFF2\>.
   * The result of bind is a new SignalsFactory that uses the SignalsBuild\<IN2, OUT2, CONFIG2, EFF2\>::build
   * of the factory returned from the mapper (hence the result of bind is not the same instance as returned by the mapper).
   *
   * @param {BindMapper} mapper - a pure function mapping from SignalsBuild\<IN, OUT, CONFIG, EFF\> to SignalsFactory\<IN2, OUT2, CONFIG2, EFF2\>
   * @returns {SignalsFactory} - a new SignalsFactory\<IN2, OUT2, CONFIG2, EFF2\>
   */
  bind<
    IN2 extends NameToSignalId,
    OUT2 extends NameToSignalId,
    CONFIG2 extends Configuration,
    EFF2 extends NameToEffectId,
  >(
    mapper: BindMapper<IN, OUT, CONFIG, EFF, IN2, OUT2, CONFIG2, EFF2>,
  ): SignalsFactory<IN2, OUT2, CONFIG2, EFF2> {
    const newBuild = (config: CONFIG2) => mapper(this.build).build(config);
    return new SignalsFactory<IN2, OUT2, CONFIG2, EFF2>(newBuild);
  }

  /**
   * This method implements the functor-fmap for the SignalsFactory.
   * It takes as argument a pure function that implements BuildMapper\<IN, OUT, CONFIG, EFF, IN2, OUT2, CONFIG2, EFF2\>, hence
   * a function taking SignalsBuild\<IN, OUT, CONFIG, EFF\> as argument and returning a SignalsBuild\<IN2, OUT2, CONFIG2, EFF2\>.
   * The result of fmap is a new SignalsFactory that uses the SignalsBuild\<IN2, OUT2, CONFIG2, EFF2\> returned
   * from the mapper.
   *
   * @param {BuildMapper} mapper - a pure function mapping from SignalsBuild\<IN, OUT, CONFIG, EFF\> to SignalsBuild\<IN2, OUT2, CONFIG2, EFF2\>
   * @returns {SignalsFactory} - a new SignalsFactory\<IN2, OUT2, CONFIG2, EFF2\>
   */
  fmap<
    IN2 extends NameToSignalId,
    OUT2 extends NameToSignalId,
    CONFIG2 extends Configuration,
    EFF2 extends NameToEffectId,
  >(
    mapper: BuildMapper<IN, OUT, CONFIG, EFF, IN2, OUT2, CONFIG2, EFF2>,
  ): SignalsFactory<IN2, OUT2, CONFIG2, EFF2> {
    const newBuild = (config: CONFIG2) => mapper(this.build)(config);
    return new SignalsFactory<IN2, OUT2, CONFIG2, EFF2>(newBuild);
  }

  /**
   * The extendSetup method takes as argument a function that implements ExtendSetup\<IN, OUT, CONFIG, EFF\>.
   * It returns a new SignalsFactory of the same type as this SignalsFactory, but with a wrapped SignalsBuild that
   * extends the code executed in the Signals setup method by the provided code.
   *
   * @param {ExtendSetup} extend - a function extending the setup method of the Signals produced by the SignalsBuild of the resulting SignalsFactory
   * @returns {SignalsFactory} - a new SignalsFactory with extended store setup
   */
  extendSetup(extend: ExtendSetup<IN, OUT, CONFIG, EFF>): SignalsFactory<IN, OUT, CONFIG, EFF> {
    return this.fmap<IN, OUT, CONFIG, EFF>(sb => config => {
      const s = sb(config);
      return {
        ...s,
        setup: (store: Store) => {
          s.setup(store);
          extend(store, s.input, s.output, config, s.effects);
        },
      };
    });
  }

  /**
   * The connect method offers an easy way to connect an output signal to an input signal.
   * It takes the name of an output-id (a key of OUT) as first argument and the name of an input-id (a key of IN) as second argument.
   * If keepInputId is set to true, it returns a new SignalsFactory of the same type as this SignalsFactory,
   * but with an extended setup logic, that connects the Signal\<S extends T\> that corresponds to the named output-id to a
   * new Signal\<T\> corresponding to the named input-id.
   * If keepInputId is set to false, it also extends the setup logic to connect the corresponding signal-ids, but in addition
   * the specified input-id will be excluded from the IN-type of the resulting factory.
   * (also see store.connect documentation, as this is used under the hood)
   * Typescript will enforce that both names (keys) map to compatible signal ids, hence if KIN corresponds to SignalId\<T\>,
   * then KOUT must correspond to SignalId\<S extends T\> (though one might be an EventId and the other a BehaviorId).
   * That is, even though you only use strings as arguments, this method is still type-safe and will not compile if you try to specify names of non-existing or incompatible ids.
   *
   * @param {KIN} inputName - a key of IN, where IN\[toName\] must be of type Signal\<T\>
   * @param {KOUT} outputName - a key of OUT, where OUT\[outputName\] must be of type Signal\<S extends T\>
   * @param {boolean} keepInputId - if set to false, the input-id corresponding to toName will be removed from the resulting factories' IN
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
  ): B extends true
    ? SignalsFactory<IN, OUT, CONFIG, EFF>
    : SignalsFactory<Omit<IN, KIN>, OUT, CONFIG, EFF> {
    const fnew: SignalsFactory<IN, OUT, CONFIG, EFF> = this.extendSetup((store, input, output) => {
      const fromId: SignalId<any> = output[outputName] as SignalId<any>;
      const toId: SignalId<any> = input[inputName] as SignalId<any>;
      store.connect(fromId, toId);
    });
    const result = (keepInputId ? fnew : fnew.removeInputId(inputName)) as B extends true
      ? SignalsFactory<IN, OUT, CONFIG, EFF>
      : SignalsFactory<Omit<IN, KIN>, OUT, CONFIG, EFF>;
    return result;
  }

  /**
   * The connectId method is a more general version of the connect method. In contrast to connect, it does not take the name
   * of an OUT signal-id, but instead directly a signal-id (thus, some arbitrary signal-id can be used).
   * Everything else works like connect, so please see the corresponding documentation there.
   *
   * @param {KIN} inputName - a key of IN, where IN\[toName\] must be of type Signal\<T\>
   * @param {ID} fromId - a Signal\<S extends T\>
   * @param {boolean} keepInputId - if set to false, the input-id corresponding to toName will be removed from the resulting factories' IN
   * @returns {SignalsFactory} - a new SignalsFactory with the concrete type depending on the keepInputId argument
   */
  connectId<K extends keyof IN, ID extends SignalId<ToSignalIdValueType<IN[K]>>, B extends boolean>(
    fromId: ID,
    inputName: K,
    keepInputId: B,
  ): B extends true
    ? SignalsFactory<IN, OUT, CONFIG, EFF>
    : SignalsFactory<Omit<IN, K>, OUT, CONFIG, EFF> {
    const fnew: SignalsFactory<IN, OUT, CONFIG, EFF> = this.extendSetup((store, input) => {
      const toId: SignalId<any> = input[inputName] as SignalId<any>;
      store.connect(fromId, toId);
    });
    const result = (keepInputId ? fnew : fnew.removeInputId(inputName)) as B extends true
      ? SignalsFactory<IN, OUT, CONFIG, EFF>
      : SignalsFactory<Omit<IN, K>, OUT, CONFIG, EFF>;
    return result;
  }

  /**
   * The connectObservable method is even more general compared to the connect and connectId methods. In contrast to the previous two,
   * its first argument is a function that takes store, output and config as arguments and returns an observable.
   * For the other arguments, please see the documentation of the connect method.
   *
   * @param {KIN} inputName - a key of IN, where IN\[toName\] must be of type Signal\<T\>
   * @param {function} sourceGetter - a function returning an Observable\<S extends T\>
   * @param {boolean} keepInputId - if set to false, the input-id corresponding to toName will be removed from the resulting factories' IN
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
  ): B extends true
    ? SignalsFactory<IN, OUT, CONFIG, EFF>
    : SignalsFactory<Omit<IN, K>, OUT, CONFIG, EFF> {
    const fnew: SignalsFactory<IN, OUT, CONFIG, EFF> = this.extendSetup((st, ip, op, conf) => {
      const toId: SignalId<any> = ip[inputName] as SignalId<any>;
      st.connectObservable(sourceGetter(st, op, conf), toId);
    });
    const result = (keepInputId ? fnew : fnew.removeInputId(inputName)) as B extends true
      ? SignalsFactory<IN, OUT, CONFIG, EFF>
      : SignalsFactory<Omit<IN, K>, OUT, CONFIG, EFF>;
    return result;
  }

  /**
   * The mapConfig method takes as argument a pure function that implements MapConfig\<CONFIG, CONFIG2\>.
   * It returns a new SignalsFactory\<IN, OUT, CONFIG2, EFF\>.
   *
   * @param {MapConfig} mapper - a pure function mapping CONFIG2 to CONFIG
   * @returns {SignalsFactory} - a new SignalsFactory with different Configuration type
   */
  mapConfig<CONFIG2 extends Configuration>(
    mapper: MapConfig<CONFIG, CONFIG2>,
  ): SignalsFactory<IN, OUT, CONFIG2, EFF> {
    const build = (config: CONFIG2) => this.build(mapper(config));
    return new SignalsFactory<IN, OUT, CONFIG2, EFF>(build);
  }

  /**
   * The mapInput method takes as argument a pure function that implements MapSignalIds\<IN, IN2\>.
   * It returns a new SignalsFactory\<IN2, OUT, CONFIG, EFF\>.
   *
   * @param {MapSignalIds} mapper - a pure function mapping from IN to IN2
   * @returns {SignalsFactory} - a new SignalsFactory with different input signals
   */
  mapInput<IN2 extends NameToSignalId>(
    mapper: MapSignalIds<IN, IN2, CONFIG>,
  ): SignalsFactory<IN2, OUT, CONFIG, EFF> {
    return this.fmap<IN2, OUT, CONFIG, EFF>(sb => config => {
      const s = sb(config);
      return {
        ...s,
        input: mapper(s.input, config),
      };
    });
  }

  /**
   * addInputId can be used as a short alternative to mapInput, if you want
   * to add just a single SignalId to the input signal ids.
   *
   * @template K - a concrete string to be used as key for the new SignalId
   * @template ID - a concrete SignalId type
   * @param {K} name - the name of the new SignalId
   * @param {function} idGetter - a function returning the new SignalId
   * @returns {SignalsFactory} - a new SignalsFactory with modified input signals
   */
  addInputId<K extends string, ID extends SignalId<any>>(
    name: AssertNonExistingKey<K, IN, 'any name not in keyof IN'>,
    idGetter: (config: CONFIG) => ID,
  ): SignalsFactory<AddSignalId<IN, K, ID>, OUT, CONFIG, EFF> {
    return this.mapInput<AddSignalId<IN, K, ID>>((input, config) => ({
      ...input,
      [name]: idGetter(config),
    }));
  }

  /**
   * renameInputId can be used as a short alternative to mapInput, if you want
   * to change the name of a single SignalId in the input signal ids.
   *
   * @template K1 - a concrete key of IN
   * @template K2 - the new name for IN\[K1\]
   * @param {K1} oldName - the old key
   * @param {K2} newName - the new key
   * @returns {SignalsFactory} - a new SignalsFactory with modified input signals
   */
  renameInputId<K1 extends keyof IN, K2 extends string>(
    oldName: K1,
    newName: K2,
  ): SignalsFactory<RenameId<IN, K1, K2>, OUT, CONFIG, EFF> {
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
   * @returns {SignalsFactory} - a new SignalsFactory with modified input signals
   */
  removeInputId<K extends keyof IN>(name: K): SignalsFactory<Omit<IN, K>, OUT, CONFIG, EFF> {
    return this.mapInput<Omit<IN, K>>(input => {
      const result = { ...input };
      delete result[name];
      return result;
    });
  }

  /**
   * The mapOutput method takes as argument a pure function that implements MapSignalIds\<OUT, OUT2\>.
   * It returns a new SignalsFactory\<IN, OUT2, CONFIG, EFF\>.
   *
   * @param {MapSignalIds} mapper - a pure function mapping from OUT to OUT2
   * @returns {SignalsFactory} - a new SignalsFactory with different output signals
   */
  mapOutput<OUT2 extends NameToSignalId>(
    mapper: MapSignalIds<OUT, OUT2, CONFIG>,
  ): SignalsFactory<IN, OUT2, CONFIG, EFF> {
    return this.fmap<IN, OUT2, CONFIG, EFF>(sb => config => {
      const s = sb(config);
      return {
        ...s,
        output: mapper(s.output, config),
      };
    });
  }

  /**
   * addOutputId can be used as a short alternative to mapOutput, if you want
   * to add just a single SignalId to the output signal ids.
   *
   * @template K - a concrete string to be used as key for the new SignalId
   * @template ID - a concrete SignalId type
   * @param {K} name - the name of the new SignalId
   * @param {function} idGetter - a function returning the new SignalId
   * @returns {SignalsFactory} - a new SignalsFactory with modified output signals
   */
  addOutputId<K extends string, ID extends SignalId<any>>(
    name: AssertNonExistingKey<K, OUT, 'any name not in keyof OUT'>,
    idGetter: (config: CONFIG) => ID,
  ): SignalsFactory<IN, AddSignalId<OUT, K, ID>, CONFIG, EFF> {
    return this.mapOutput<AddSignalId<OUT, K, ID>>((output, config) => ({
      ...output,
      [name]: idGetter(config),
    }));
  }

  /**
   * renameOutputId can be used as a short alternative to mapOutput, if you want
   * to change the name of a single SignalId in the output signal ids.
   *
   * @template K1 - a concrete key of OUT
   * @template K2 - the new name for OUT\[K1\]
   * @param {K1} oldName - the old key
   * @param {K2} newName - the new key
   * @returns {SignalsFactory} - a new SignalsFactory with modified output signals
   */
  renameOutputId<K1 extends keyof OUT, K2 extends string>(
    oldName: K1,
    newName: K2,
  ): SignalsFactory<IN, RenameId<OUT, K1, K2>, CONFIG, EFF> {
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
   * @returns {SignalsFactory} - a new SignalsFactory with modified output signals
   */
  removeOutputId<K extends keyof OUT>(name: K): SignalsFactory<IN, Omit<OUT, K>, CONFIG, EFF> {
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
   * Hence, this transforms from SignalsFactory\<IN, OUT, CONFIG\> to SignalsFactory\<IN, OUT2, CONFIG\>
   * with OUT2 having the same keys as OUT, but OUT2\[KOUT\] having type TNEW and OUT\[KOUT\] having type TOLD
   *
   * @template KOUT - a concrete output key mapping to a BehaviorId<any>
   * @template TNEW - value-type of the OUT2\[KOUT\] BehaviorId after mapping
   * @param {KOUT} outputName - the name of a BehaviorId\<any\> from OUT
   * @param {function} mapper - a function returning Observable\<TNEW\>
   * @returns {SignalsFactory} - a new SignalsFactory with a modified output signal
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
  ): SignalsFactory<IN, AddOrReplaceId<OUT, KOUT, DerivedId<TNEW>>, CONFIG, EFF> {
    return this.fmap<IN, AddOrReplaceId<OUT, KOUT, DerivedId<TNEW>>, CONFIG, EFF>(sb => config => {
      const s = sb(config);
      const newId = getDerivedId<TNEW>();
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

  /**
   * The mapEffects method takes as argument a pure function that implements MapEffectIds\<EFF, EFF2, CONFIG\>.
   * It returns a new SignalsFactory\<IN, OUT, CONFIG, EFF2\>.
   *
   * @param {MapSignalIds} mapper - a pure function mapping from EFF to EFF2
   * @returns {SignalsFactory} - a new SignalsFactory with different effect-ids
   */
  mapEffects<EFF2 extends NameToEffectId>(
    mapper: MapEffectIds<EFF, EFF2, CONFIG>,
  ): SignalsFactory<IN, OUT, CONFIG, EFF2> {
    return this.fmap<IN, OUT, CONFIG, EFF2>(sb => config => {
      const s = sb(config);
      return {
        ...s,
        effects: mapper(s.effects, config),
      };
    });
  }

  /**
   * addEffectId can be used as a short alternative to mapEffects, if you want
   * to add just a single EffectId to the effect-ids.
   *
   * @template K - a concrete string to be used as key for the new EffectId
   * @template ID - a concrete EffectId type
   * @param {K} name - the name of the new EffectId
   * @param {function} idGetter - a function returning the new EffectId
   * @returns {SignalsFactory} - a new SignalsFactory with modified effect-ids
   */
  addEffectId<K extends string, ID extends EffectId<any, any>>(
    name: AssertNonExistingKey<K, EFF, 'any name not in keyof EFF'>,
    idGetter: (config: CONFIG) => ID,
  ): SignalsFactory<IN, OUT, CONFIG, AddEffectId<EFF, K, ID>> {
    return this.mapEffects<AddEffectId<EFF, K, ID>>((effects, config) => ({
      ...effects,
      [name]: idGetter(config),
    }));
  }

  /**
   * removeEffectId can be used as a short alternative to mapEffects, if you want
   * to remove just a single EffectId from the effect-ids.
   *
   * @template K - a concrete key of the effect-ids of this factory
   * @param {K} name - the name of in NameToEffectIds to be removed
   * @returns {SignalsFactory} - a new SignalsFactory with modified effect-ids
   */
  removeEffectId<K extends keyof EFF>(name: K): SignalsFactory<IN, OUT, CONFIG, Omit<EFF, K>> {
    return this.mapEffects<Omit<EFF, K>>(effects => {
      const result = { ...effects };
      delete result[name];
      return result;
    });
  }

  /**
   * useExistingEffect can be used to get a factory that uses an existing effect
   * as the effect referenced by a given effect-id generated by this factory.
   *
   * @template K - a concrete key of the effect-ids of this factory
   * @param {K} name - a name from this factory's effects, mapping to a concrete EffectId
   * @param {function} idGetter - a function, getting the config as argument and returning the EffectId of an existing effect that should be used for the EffectId specified by K.
   * @param {B} keepEffectId - specifies whether the resulting SignalsFactory should still produce the EffectId referenced by K.
   * @returns {SignalsFactory} - a new SignalsFactory with the concrete type depending on the keepInputId argument
   */
  useExistingEffect<
    InputType,
    ResultType,
    K extends KeysOfValueType<EFF, EffectId<InputType, ResultType>>,
    B extends boolean,
  >(
    name: K,
    idGetter: (config: CONFIG) => EffectId<InputType, ResultType>,
    keepEffectId: B,
  ): B extends true
    ? SignalsFactory<IN, OUT, CONFIG, EFF>
    : SignalsFactory<IN, OUT, CONFIG, Omit<EFF, K>> {
    const result = this.extendSetup((store, _, _2, config, effects) => {
      store
        .getEffect(idGetter(config))
        .pipe(take(1))
        .subscribe(effect => {
          store.addEffect(effects[name] as EffectId<InputType, ResultType>, effect);
        });
    });
    return (keepEffectId ? result : result.removeEffectId(name)) as B extends true
      ? SignalsFactory<IN, OUT, CONFIG, EFF>
      : SignalsFactory<IN, OUT, CONFIG, Omit<EFF, K>>;
  }

  /**
   * renameEffectId can be used as a short alternative to mapEffects, if you want
   * to change the name of a single EffectId in the effect-ids.
   *
   * @template K1 - a concrete key of EFF
   * @template K2 - the new name for EFF[K1]
   * @param {K1} oldName - the old key
   * @param {K2} newName - the new key
   * @returns {SignalsFactory} - a new SignalsFactory with modified effect-ids
   */
  renameEffectId<K1 extends keyof EFF, K2 extends string>(
    oldName: K1,
    newName: K2,
  ): SignalsFactory<IN, OUT, CONFIG, RenameEffectId<EFF, K1, K2>> {
    return this.mapEffects<RenameEffectId<EFF, K1, K2>>(effects => {
      const { [oldName]: mapId, ...rest } = effects;
      const result = {
        ...rest,
        [newName]: mapId,
      };
      return result as RenameEffectId<EFF, K1, K2>;
    });
  }
}
