import { Observable } from 'rxjs';

/**
 * The rx-signals Store uses this type to uniquely identify all of its behaviors.
 * A BehaviorId<T> does not make any use of the generic T itself, but is given this
 * parameter only as a trick to let Typescript infer and thus enforce the correct types.
 * Use the getBehaviorId<T>() function to generate a corresponding ID.
 *
 * @typedef {object} BehaviorId<T> - type to uniquely identify a certain behavior
 * @template T - specifies the type for the corresponding behavior observable
 * @property {symbol} symbol - a symbol, making the BehaviorId unique
 */
export type BehaviorId<T> = symbol & {
  _behaviorTypeTemplate: T;
};

/**
 * The rx-signals Store uses this type to uniquely identify all of its events.
 * An EventId<T> does not make any use of the generic T itself, but is given this
 * parameter only as a trick to let Typescript infer and thus enforce the correct types.
 * Use the getEventId<T>() function to generate a corresponding ID.
 *
 * @typedef {object} EventId<T> - type to uniquely identify a certain event
 * @template T - specifies the type for the corresponding event observable
 * @property {symbol} symbol - a symbol, making the EventId unique
 */
export type EventId<T> = symbol & {
  _eventTypeTemplate: T;
};

/**
 * SignalId<T> is the union type of BehaviorId<T> and EventId<T>, hence it
 * represents an identifier that corresponds either to a behavior or to an event.
 * You can use the functions isBehaviorId or isEventId to check the concrete
 * type of a SignalId.
 *
 * @typedef {object} EventId<T> - type to uniquely identify a certain event
 * @template T - specifies the type for the corresponding event observable
 */
export type SignalId<T> = BehaviorId<T> | EventId<T>;

/**
 * ToSignalId<S> is a utility type that equals Signal<T>, if S extends SignalId<T>, else never.
 * Examples:
 *    ToSignalId<BehaviorId<number>> would be SignalId<number>
 *    ToSignalId<EventId<string>> would be SignalId<string>
 *    ToSignalId<number> would be never
 *
 * @typedef {object} SignalId<T> | never - the resulting type
 * @template S - the generic argument to ToSignalId
 * @template T - the inferred generic parameter of S, if S extends SignalId<T>
 */
export type ToSignalId<S> = S extends SignalId<infer T> ? SignalId<T> : never;

/**
 * ToBehaviorIdValueType<B> is a utility type that equals T, if B extends BehaviorId<T>, else never.
 * Examples:
 *    ToBehaviorIdValueType<BehaviorId<number>> would be number
 *    ToBehaviorIdValueType<EventId<string>> would be never
 *
 * @typedef {T | never} T | never - the resulting type
 * @template B - the generic argument to ToBehaviorIdValueType
 * @template T - the inferred generic parameter of B, if B extends BehaviorId<T>
 */
export type ToBehaviorIdValueType<B> = B extends BehaviorId<infer T> ? T : never;

/**
 * ToEventIdValueType<E> is a utility type that equals T, if E extends EventId<T>, else never.
 * Examples:
 *    ToEventIdValueType<EventId<number>> would be number
 *    ToEventIdValueType<BehaviorId<string>> would be never
 *
 * @typedef {T | never} T | never - the resulting type
 * @template E - the generic argument to ToEventIdValueType
 * @template T - the inferred generic parameter of E, if E extends EventId<T>
 */
export type ToEventIdValueType<E> = E extends EventId<infer T> ? T : never;

/**
 * ToSignalIdValueType<S> is a utility type that equals T, if S extends SignalId<T>, else never.
 * Examples:
 *    ToSignalIdValueType<EventId<number>> would be number
 *    ToSignalIdValueType<EventId<string>> would be string
 *    ToSignalIdValueType<number> would be never
 *
 * @typedef {T | never} T | never - the resulting type
 * @template S - the generic argument to ToSignalIdValueType
 * @template T - the inferred generic parameter of S, if S extends SignalId<T>
 */
export type ToSignalIdValueType<S> = S extends SignalId<infer T> ? T : never;

/**
 * ToObservableValueType<O> is a utility type that equals T, if O extends Observable<T>, else never.
 * Examples:
 *    ToObservableValueType<Observable<number>> would be number
 *    ToObservableValueType<Observable<string>> would be string
 *    ToObservableValueType<number> would be never
 *
 * @typedef {T | never} T | never - the resulting type
 * @template O - the generic argument to ToObservableValueType
 * @template T - the inferred generic parameter of O, if O extends Observable<T>
 */
export type ToObservableValueType<O> = O extends Observable<infer T> ? T : never;

/**
 * The rx-signals Store uses this type to uniquely identify all of its result effects.
 * An EffectId<InputType, ResultType> does not make any use of the generic parameters itself,
 * but is given these parameters only as a trick to let Typescript infer and thus enforce the correct types.
 * Use the getEffectId<InputType, ResultType>() function to generate a corresponding ID.
 *
 * @typedef {object} EffectId<InputType, ResultType> - type to uniquely identify a certain result effect
 * @template InputType - specifies the type for the corresponding effects input
 * @template ResultType - specifies the type for the corresponding effects result
 * @property {symbol} symbol - a symbol, making the EffectId unique
 */
export type EffectId<InputType, ResultType> = symbol & {
  _inputTypeTemplate: InputType;
  _resultTypeTemplate: ResultType;
};

let behaviorExtension = 1;
let eventExtension = 1;
let effectExtension = 1;

/**
 * Function to get a new, unique BehaviorId.
 *
 * @template T - specifies the type for the corresponding behavior
 * @param {string} nameExtension - an optional extension to the symbol name (so the string representation). Usually, you don't need this, cause even for debugging purposes, you should use store.setIdName/getIdName.
 * @returns {BehaviorId<T>}
 */
export const getBehaviorId = <T>(nameExtension?: string): BehaviorId<T> =>
  Symbol(`B_${(nameExtension ?? '') + behaviorExtension++}`) as BehaviorId<T>;

/**
 * Function to get a new, unique EventId.
 *
 * @template T - specifies the type for the corresponding event
 * @param {string} nameExtension - an optional extension to the symbol name (so the string representation). Usually, you don't need this, cause even for debugging purposes, you should use store.setIdName/getIdName.
 * @returns {EventId<T>}
 */
export const getEventId = <T>(nameExtension?: string): EventId<T> =>
  Symbol(`E_${(nameExtension ?? '') + eventExtension++}`) as EventId<T>;

/**
 * Function to get a new, unique EffectId.
 *
 * @template InputType - specifies the type for the corresponding effects input
 * @template ResultType - specifies the type for the corresponding effects result
 * @param {string} nameExtension - an optional extension to the symbol name (so the string representation). Usually you should not need this.
 * @returns {EventId<T>}
 */
export const getEffectId = <InputType, ResultType>(
  nameExtension?: string,
): EffectId<InputType, ResultType> =>
  Symbol(`Effect_${(nameExtension ?? '') + effectExtension++}`) as EffectId<InputType, ResultType>;

/**
 * Function to check whether a given SignalId is a BehaviorId.
 *
 * @template T - specifies the type for the corresponding signal
 * @param {Signal<T>} id - a signal identifier.
 * @returns {boolean}
 */
export const isBehaviorId = <T>(id: SignalId<T>): boolean => id.toString().startsWith('Symbol(B');

/**
 * Function to check whether a given SignalId is an EventId.
 *
 * @template T - specifies the type for the corresponding signal
 * @param {Signal<T>} id - a signal identifier.
 * @returns {boolean}
 */
export const isEventId = <T>(id: SignalId<T>): boolean => id.toString().startsWith('Symbol(E');

/**
 * A constant symbol representing the intentional absence of a value.
 * (even undefined and null are valid values, so these cannot be used to represent no-value).
 */
export const NO_VALUE: symbol = Symbol('NO_VALUE');
