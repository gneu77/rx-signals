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
 * @typedef {function} FactoryBuild<IN, OUT> - type for the build method of SignalsFactories
 * @template IN - concrete NameToSignalIds defining input signals of the resulting SignalsFactory
 * @template OUT - concrete NameToSignalIds defining output signals of the resulting SignalsFactory
 */
export type FactoryBuild<
  IN extends NameToSignalId,
  OUT extends NameToSignalId,
  CONFIG extends Configuration,
> = (config: CONFIG) => Signals<IN, OUT>;

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

export type ExtendSetup<
  IN extends NameToSignalId,
  OUT extends NameToSignalId,
  CONFIG extends Configuration,
> = (store: Store, input: IN, output: OUT, config: CONFIG) => void;

export type MapConfig<CONFIG1 extends Configuration, CONFIG2 extends Configuration> = (
  config: CONFIG2,
) => CONFIG1;

export type MapSignalIds<T1 extends NameToSignalId, T2 extends NameToSignalId> = (ids: T1) => T2;

export class SignalsFactory<
  IN extends NameToSignalId,
  OUT extends NameToSignalId,
  CONFIG extends Configuration = {},
> {
  constructor(readonly build: FactoryBuild<IN, OUT, CONFIG>) {}

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

  fmap<IN2 extends NameToSignalId, OUT2 extends NameToSignalId>(
    mapper: SignalsMapper<IN, OUT, IN2, OUT2, CONFIG>,
  ): SignalsFactory<IN2, OUT2, CONFIG> {
    const build = (config: CONFIG) => mapper(this.build(config), config);
    return new SignalsFactory<IN2, OUT2, CONFIG>(build);
  }

  extendSetup(extend: ExtendSetup<IN, OUT, CONFIG>): SignalsFactory<IN, OUT, CONFIG> {
    return this.fmap((s, config) => ({
      ...s,
      setup: (store: Store) => {
        s.setup(store);
        extend(store, s.input, s.output, config);
      },
    }));
  }

  mapInput<IN2 extends NameToSignalId>(
    mapper: MapSignalIds<IN, IN2>,
  ): SignalsFactory<IN2, OUT, CONFIG> {
    return this.fmap(s => ({
      ...s,
      input: mapper(s.input),
    }));
  }

  mapOutput<OUT2 extends NameToSignalId>(
    mapper: MapSignalIds<OUT, OUT2>,
  ): SignalsFactory<IN, OUT2, CONFIG> {
    return this.fmap(s => ({
      ...s,
      output: mapper(s.output),
    }));
  }

  mapConfig<CONFIG2 extends Configuration>(
    mapper: MapConfig<CONFIG, CONFIG2>,
  ): SignalsFactory<IN, OUT, CONFIG2> {
    const build = (config: CONFIG2) => this.build(mapper(config));
    return new SignalsFactory<IN, OUT, CONFIG2>(build);
  }
}
