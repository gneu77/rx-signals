import { Observable } from 'rxjs';

/**
 * The rx-signals {@link Store} uses this type to uniquely identify behaviors representing a root-state behavior.
 * A `StateId<T>` does not make any use of the generic `T` itself, but is given this
 * parameter only as a trick to let Typescript infer and thus enforce the correct types.
 * Use the {@link getStateId} function to generate a corresponding ID.
 *
 * @template T - specifies the value-type for the corresponding behavior observable (type of the state)
 */
export type StateId<T> = symbol & {
  _rootStateType: T;
};

/**
 * The rx-signals {@link Store} uses this type to uniquely identify behaviors representing a derived-state behavior.
 * A `DerivedId<T> does not make any use of the generic `T` itself, but is given this
 * parameter only as a trick to let Typescript infer and thus enforce the correct types.
 * Use the {@link getDerivedId} function to generate a corresponding ID.
 *
 * @template T - specifies the value-type for the corresponding behavior observable
 */
export type DerivedId<T> = symbol & {
  _derivedStateType: T;
};

/**
 * The rx-signals {@link Store} uses this type for cases where either a {@link StateId} or a {@link DerivedId} is expected.
 *
 * @template T - specifies the value-type for the corresponding behavior observable
 */
export type BehaviorId<T> = StateId<T> | DerivedId<T>;

/**
 * The rx-signals {@link Store} uses this type to uniquely identify all of its events.
 * An `EventId<T>` does not make any use of the generic `T` itself, but is given this
 * parameter only as a trick to let Typescript infer and thus enforce the correct types.
 * Use the {@link getEventId} function to generate a corresponding ID.
 *
 * @template T - specifies the value-type for the corresponding event observable
 */
export type EventId<T> = symbol & {
  _eventType: T;
};

/**
 * `SignalId<T>` is the union type of `BehaviorId<T>` and `EventId<T>`, hence it
 * represents an identifier that corresponds either to a behavior or to an event.
 * You can use the typeguards {@link isBehaviorId} or {@link isEventId} to check the concrete
 * type of a `SignalId`.
 *
 * @template T - specifies the value-type for the corresponding observable
 */
export type SignalId<T> = BehaviorId<T> | EventId<T>;

/**
 * `ToSignalId<S>` is a utility type that equals `Signal<T>`, if `S extends SignalId<T>`, else `never`.
 *
 * ```ts
 *    ToSignalId<BehaviorId<number>> = SignalId<number>
 *    ToSignalId<EventId<string>> = SignalId<string>
 *    ToSignalId<number> = never
 * ```
 *
 * @template S - the generic argument to `ToSignalId`
 * @template T - the inferred generic parameter of `S`, if `S extends SignalId<T>`
 */
export type ToSignalId<S> = S extends SignalId<infer T> ? SignalId<T> : never;

/**
 * `ToBehaviorIdValueType<B>` is a utility type that equals `T`, if `B extends BehaviorId<T>`, else `never`.
 *
 * ```ts
 *    ToBehaviorIdValueType<BehaviorId<number>> = number
 *    ToBehaviorIdValueType<EventId<string>> = never
 * ```
 *
 * @template B - the generic argument to `ToBehaviorIdValueType`
 * @template T - the inferred generic parameter of `B`, if `B extends BehaviorId<T>`
 */
export type ToBehaviorIdValueType<B> = B extends BehaviorId<infer T> ? T : never;

/**
 * `ToEventIdValueType<E>` is a utility type that equals `T`, if `E extends EventId<T>`, else `never`.
 *
 * ```ts
 *    ToEventIdValueType<EventId<number>> = number
 *    ToEventIdValueType<BehaviorId<string>> = never
 * ```
 *
 * @template E - the generic argument to `ToEventIdValueType`
 * @template T - the inferred generic parameter of `E`, if `E extends EventId<T>`
 */
export type ToEventIdValueType<E> = E extends EventId<infer T> ? T : never;

/**
 * `ToSignalIdValueType<S>` is a utility type that equals `T`, if `S extends SignalId<T>`, else `never`.
 *
 * ```ts
 *    ToSignalIdValueType<EventId<number>> = number
 *    ToSignalIdValueType<EventId<string>> = string
 *    ToSignalIdValueType<number> = never
 * ```
 *
 * @template S - the generic argument to `ToSignalIdValueType`
 * @template T - the inferred generic parameter of `S`, if `S extends SignalId<T>`
 */
export type ToSignalIdValueType<S> = S extends SignalId<infer T> ? T : never;

/**
 * `ToObservableValueType<O>` is a utility type that equals `T`, if `O extends Observable<T>`, else `never`.
 *
 * ```ts
 *    ToObservableValueType<Observable<number>> = number
 *    ToObservableValueType<Observable<string>> = string
 *    ToObservableValueType<number> = never
 * ```
 *
 * @template O - the generic argument to `ToObservableValueType`
 * @template T - the inferred generic parameter of `O`, if `O extends Observable<T>`
 */
export type ToObservableValueType<O> = O extends Observable<infer T> ? T : never;

/**
 * The rx-signals `Store` uses this type to uniquely identify all of its result effects.
 * An `EffectId<InputType, ResultType, ErrorType>` does not make any use of the generic parameters itself,
 * but is given these parameters only as a trick to let Typescript infer and thus enforce the correct types.
 * Use the {@link getEffectId} function to generate a corresponding ID.
 *
 * @template InputType - specifies the type for the corresponding effects input
 * @template ResultType - specifies the type for the corresponding effects result
 * @template ErrorType - specifies the type error-type for the effect. Use never for effects that cannot error.
 */
export type EffectId<InputType, ResultType, ErrorType = unknown> = symbol & {
  _inputType: InputType;
  _resultType: ResultType;
  _errorType: ErrorType;
};

let stateExtension = 1;
let derivedExtension = 1;
let eventExtension = 1;
let effectExtension = 1;

/**
 * Function to get a new, unique `StateId`.
 *
 * @template T - specifies the value-type for the corresponding behavior
 * @param {string} nameExtension - an optional extension to the symbol name (so the string representation). Usually, you don't need this, cause even for debugging purposes, you should use {@link Store.setIdName} and {@link Store.getIdName}.
 * @returns {StateId<T>}
 */
export const getStateId = <T>(nameExtension?: string): StateId<T> =>
  Symbol(`S_${(nameExtension ?? '') + stateExtension++}`) as StateId<T>;

/**
 * Function to get a new, unique `DerivedId`.
 *
 * @template T - specifies the value-type for the corresponding behavior
 * @param {string} nameExtension - an optional extension to the symbol name (so the string representation). Usually, you don't need this, cause even for debugging purposes, you should use {@link Store.setIdName} and {@link Store.getIdName}.
 * @returns {DerivedId<T>}
 */
export const getDerivedId = <T>(nameExtension?: string): DerivedId<T> =>
  Symbol(`D_${(nameExtension ?? '') + derivedExtension++}`) as DerivedId<T>;

/**
 * Function to get a new, unique `EventId`.
 *
 * @template T - specifies the value-type for the corresponding event
 * @param {string} nameExtension - an optional extension to the symbol name (so the string representation). Usually, you don't need this, cause even for debugging purposes, you should use {@link Store.setIdName} and {@link Store.getIdName}.
 * @returns {EventId<T>}
 */
export const getEventId = <T>(nameExtension?: string): EventId<T> =>
  Symbol(`E_${(nameExtension ?? '') + eventExtension++}`) as EventId<T>;

/**
 * Function to get a new, unique `EffectId`.
 *
 * @template InputType - specifies the type for the corresponding effects input
 * @template ResultType - specifies the type for the corresponding effects result
 * @template ErrorType - specifies the type error-type for the effect. Use `never` for effects that cannot error.
 * @param {string} nameExtension - an optional extension to the symbol name (so the string representation). Usually you should not need this.
 * @returns {EventId<T>}
 */
export const getEffectId = <InputType, ResultType, ErrorType = unknown>(
  nameExtension?: string,
): EffectId<InputType, ResultType, ErrorType> =>
  Symbol(`Effect_${(nameExtension ?? '') + effectExtension++}`) as EffectId<
    InputType,
    ResultType,
    ErrorType
  >;

/**
 * Typeguard to check whether a given `SignalId` is a `StateId`.
 *
 * @template T - specifies the type for the corresponding signal
 * @param {Signal<T>} id - a signal identifier.
 * @returns {boolean}
 */
export const isStateId = <T>(id: SignalId<T>): id is StateId<T> =>
  id.toString().startsWith('Symbol(S');

/**
 * Typeguard to check whether a given `SignalId` is a `DerivedId`.
 *
 * @template T - specifies the type for the corresponding signal
 * @param {Signal<T>} id - a signal identifier.
 * @returns {boolean}
 */
export const isDerivedId = <T>(id: SignalId<T>): id is DerivedId<T> =>
  id.toString().startsWith('Symbol(D');

/**
 * Typeguard to check whether a given `SignalId` is a `BehaviorId`.
 *
 * @template T - specifies the type for the corresponding signal
 * @param {Signal<T>} id - a signal identifier.
 * @returns {boolean}
 */
export const isBehaviorId = <T>(id: SignalId<T>): id is BehaviorId<T> =>
  isStateId(id) || isDerivedId(id);

/**
 * Typeguard to check whether a given `SignalId` is an `EventId`.
 *
 * @template T - specifies the type for the corresponding signal
 * @param {Signal<T>} id - a signal identifier.
 * @returns {boolean}
 */
export const isEventId = <T>(id: SignalId<T>): id is EventId<T> =>
  id.toString().startsWith('Symbol(E');

/**
 * A constant representing the intentional absence of a value.
 * Even undefined and null are valid values, so these cannot be used to represent no-value.
 */
export const NO_VALUE: '$RX-SIGNALS-NO-VALUE$' = '$RX-SIGNALS-NO-VALUE$';

/**
 * The corresponding type for {@link NO_VALUE}
 */
export type NoValueType = typeof NO_VALUE;

/**
 * Typeguard to check if a value is NOT {@link NO_VALUE}
 */
export const isNotNoValueType = <T>(v: T): v is Exclude<T, NoValueType> => v !== NO_VALUE;

/**
 * Typeguard to check if a value is {@link NO_VALUE}
 */
export const isNoValueType = (v: any): v is NoValueType => v === NO_VALUE;
