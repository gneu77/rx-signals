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
 * @property {symbol} symbol - a symbol, making the EventId unique
 */
export type SignalId<T> = BehaviorId<T> | EventId<T>;

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

/**
 * Function to get a new, unique BehaviorId.
 *
 * @template T - specifies the type for the corresponding behavior
 * @returns {BehaviorId<T>}
 */
export const getBehaviorId = <T>(): BehaviorId<T> => Symbol('B') as BehaviorId<T>;

/**
 * Function to get a new, unique EventId.
 *
 * @template T - specifies the type for the corresponding event
 * @returns {EventId<T>}
 */
export const getEventId = <T>(): EventId<T> => Symbol('E') as EventId<T>;

/**
 * Function to get a new, unique EffectId.
 *
 * @template InputType - specifies the type for the corresponding effects input
 * @template ResultType - specifies the type for the corresponding effects result
 * @returns {EventId<T>}
 */
export const getEffectId = <InputType, ResultType>(): EffectId<InputType, ResultType> =>
  Symbol('Effect') as EffectId<InputType, ResultType>;

/**
 * Function to check whether a given SignalId is a BehaviorId.
 *
 * @template T - specifies the type for the corresponding signal
 * @param {Signal<T>} id - a signal identifier.
 * @returns {boolean}
 */
export const isBehaviorId = <T>(id: SignalId<T>): boolean => id.toString() === 'Symbol(B)';

/**
 * Function to check whether a given SignalId is an EventId.
 *
 * @template T - specifies the type for the corresponding signal
 * @param {Signal<T>} id - a signal identifier.
 * @returns {boolean}
 */
export const isEventId = <T>(id: SignalId<T>): boolean => id.toString() === 'Symbol(E)';

/**
 * A constant symbol representing the intentional absence of a value.
 * (even undefined and null are valid values, so these cannot be used to represent no-value).
 */
export const NO_VALUE: symbol = Symbol('NO_VALUE');
