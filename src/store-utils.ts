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

export type SignalId<T> = BehaviorId<T> | EventId<T>;

/**
 * Function to get a new BehaviorId for the rx-signals store.
 *
 * @template T - specifies the type for the corresponding behavior
 * @param {string} name - an optional name for the resulting BehaviorId symbol
 * @returns {BehaviorId<T>}
 */
export const getBehaviorId = <T>(name?: string): BehaviorId<T> =>
  Symbol(`b_${name ?? ''}`) as BehaviorId<T>;

/**
 * Function to get a new EventId for the rx-signals store.
 *
 * @template T - specifies the type for the corresponding event
 * @param {string} name - an optional name for the resulting EventId symbol
 * @returns {EventId<T>}
 */
export const getEventId = <T>(name?: string): EventId<T> => Symbol(`e_${name ?? ''}`) as EventId<T>;

export const isBehaviorId = <T>(id: SignalId<T>): boolean => id.toString().startsWith('Symbol(b_');

export const isEventId = <T>(id: SignalId<T>): boolean => id.toString().startsWith('Symbol(e_');

export const NO_VALUE: symbol = Symbol('NO_VALUE');
