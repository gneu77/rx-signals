/* eslint-disable @typescript-eslint/no-use-before-define */

import { Store } from './store';

export interface SetupWithStore {
  readonly setup: (store: Store) => void;
}

export interface SignalsTypeWrapper<SignalsType> {
  signals: SignalsType;
}

export type Signals<SignalsType> = SetupWithStore & SignalsTypeWrapper<SignalsType>;

export interface MappedSignalsType<SignalsType1, SignalsType2> {
  readonly signals1: SignalsType1;
  readonly signals2: SignalsType2;
}

export interface SignalsFactory<SignalsType> {
  readonly build: () => Signals<SignalsType>;
  readonly bind: <SignalsType2>(
    mapper: (signals: Signals<SignalsType>) => SignalsFactory<SignalsType2>,
  ) => SignalsFactory<MappedSignalsType<SignalsType, SignalsType2>>;
  readonly fmap: <SignalsType2>(
    mapper: (signals: Signals<SignalsType>) => Signals<SignalsType2>,
  ) => SignalsFactory<SignalsType2>;
}

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

export type FactoryMap<
  SignalsType1,
  SignalsType2,
  FactoryType1 extends SignalsFactory<SignalsType1>,
  FactoryType2 extends SignalsFactory<SignalsType2>
> = (
  factory1: FactoryType1,
  mapper: (signals: Signals<SignalsType1>) => Signals<SignalsType2>,
  concreteMapper: (factory2: SignalsFactory<SignalsType2>) => FactoryType2,
) => FactoryType2;

export type FactoryBind<
  SignalsType1,
  SignalsType2,
  FactoryType1 extends SignalsFactory<SignalsType1>,
  FactoryType2 extends SignalsFactory<SignalsType2>
> = (
  factory1: FactoryType1,
  mapper: (signals: Signals<SignalsType1>) => SignalsFactory<SignalsType2>,
  concreteMapper: (
    factory2: SignalsFactory<MappedSignalsType<SignalsType1, SignalsType2>>,
  ) => FactoryType2,
) => FactoryType2;

export interface ConcreteSignalsFactory<SignalsType> extends SignalsFactory<SignalsType> {
  readonly concreteBind: <SignalsType2, FactoryType2 extends SignalsFactory<SignalsType2>>(
    mapper: (signals: Signals<SignalsType>) => SignalsFactory<SignalsType2>,
    concreteMapper: (
      factory2: SignalsFactory<MappedSignalsType<SignalsType, SignalsType2>>,
    ) => FactoryType2,
  ) => FactoryType2;
  readonly concreteMap: <SignalsType2, FactoryType2 extends SignalsFactory<SignalsType2>>(
    mapper: (signals: Signals<SignalsType>) => Signals<SignalsType2>,
    concreteMapper: (factory2: SignalsFactory<SignalsType2>) => FactoryType2,
  ) => FactoryType2;
}

export const concreteFactoryMap = <
  SignalsType1,
  SignalsType2,
  FactoryType1 extends SignalsFactory<SignalsType1>,
  FactoryType2 extends SignalsFactory<SignalsType2>
>(
  factory1: FactoryType1,
  mapper: (signals: Signals<SignalsType1>) => Signals<SignalsType2>,
  concreteMapper: (factory2: SignalsFactory<SignalsType2>) => FactoryType2,
): FactoryType2 => concreteMapper(signalsFactoryMap(factory1, mapper));

export const concreteFactoryBind = <
  SignalsType1,
  SignalsType2,
  FactoryType1 extends SignalsFactory<SignalsType1>,
  FactoryType2 extends SignalsFactory<SignalsType2>
>(
  factory1: FactoryType1,
  mapper: (signals: Signals<SignalsType1>) => SignalsFactory<SignalsType2>,
  concreteMapper: (
    factory2: SignalsFactory<MappedSignalsType<SignalsType1, SignalsType2>>,
  ) => FactoryType2,
): FactoryType2 => concreteMapper(signalsFactoryBind(factory1, mapper));
