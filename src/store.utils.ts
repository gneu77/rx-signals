/**
 * The RX-SIGNALS Store uses this type to uniquely identify all of its behaviors and events.
 * A TypeIdentifier<T> does not make any use of the generic T itself, but is given this
 * parameter only as a trick to let Typescript infer and thus enforce the correct types.
 * Use the getIdentifier<T>() method to generate a corresponding ID.
 *
 * @typedef {object} TypeIdentifier<T> - type to uniquely identify a certain behavior or event
 * @template T - specifies the type for the corresponding behavior or event observable
 * @property {symbol} symbol - a symbol, making the TypeIdentifier unique
 */
export type TypeIdentifier<T> = symbol & {
  _typeTemplate: T;
};

/**
 * A simple helper function to get a new TypeIdentifier for the RX-SIGNALS store.
 *
 * @template T - specifies the type for the corresponding store signal
 * @param {string} name - an optional name for the resulting TypeIdentifier symbol
 * @returns {TypeIdentifier<T>}
 */
export const getIdentifier = <T>(name?: string): TypeIdentifier<T> =>
  Symbol(name) as TypeIdentifier<T>;

export const NO_VALUE: symbol = Symbol('NO_VALUE');
