/**
 * The RX-SIGNALS Store uses this type to uniquely identify all of its behaviors and events.
 * A TypeIdentifier<T> does not make any use of the generic T itself, but is given this
 * parameter only as a trick to let Typescript infer and thus enforce the correct types.
 *
 * @typedef {object} TypeIdentifier<T> - interface for an object used to identify a certain behavior or event
 * @template T - specifies the type for the corresponding behavior or event observable
 * @property {symbol} symbol - a symbol, making the TypeIdentifier unique
 */
export interface TypeIdentifier<T> {
  _typeTemplate?: T | undefined; // should always be undefined (just here to make TS happy)
  readonly symbol: symbol;
}

/**
 * A simple helper function to get a new TypeIdentifier for the RX-SIGNALS store.
 *
 * @template T - specifies the type for the corresponding store signal
 * @param {string} name - an optional name for the resulting TypeIdentifier symbol
 * @returns {TypeIdentifier<T>}
 */
export const getIdentifier = <T>(name?: string): TypeIdentifier<T> => ({
  symbol: Symbol(name),
});

export const NO_VALUE: symbol = Symbol('NO_VALUE');
