import { Observable } from 'rxjs';
import { Store, TypeIdentifier } from './store';

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

/**
 * @typedef {function} EffectType<InputModel, ResultModel> - generic type for effects that can be passed to signals factories
 * @template InputModel - specifies the type of the effects input
 * @template ResultModel - specifies the type of the effects result
 * @property {InputModel} input - effect input
 * @property {Store} store - effects can take a store instance (to provide further effects input)
 */
export type EffectType<InputModel, ResultModel> = (
  input: InputModel,
  store: Store,
) => Observable<ResultModel>;

/**
 * @typedef {object} UnhandledEffectErrorEvent<InputModel> - generic type for unhandled-error-events
 * @template InputModel - specifies the type of the effects input
 * @property {InputModel} input - effect input that lead to the error
 * @property {any} error - the error that occurred
 */
export interface UnhandledEffectErrorEvent<InputModel> {
  readonly input: InputModel;
  readonly error: any;
}

/**
 * @typedef {object} SignalsFactoryOptions<InputModel> - base options interface for all signals factories
 * @template InputModel - input model for the signals factory
 * @property {function} inputEquals - optional equal function for the input model (factories will use reference equals as default)
 * @property {string} identifierNamePrefix - optional name prefix for all symbol descriptions
 * @property {number} inputDebounceTime - optional debounce time for signals input. The default depends on the concrete signals factory
 */
export interface SignalsFactoryOptions<InputModel> {
  readonly inputEquals?: (prevInput?: InputModel, nextInput?: InputModel) => boolean;
  readonly identifierNamePrefix?: string;
  readonly inputDebounceTime?: number;
}

/**
 * @typedef {object} SignalsFactory - base type for all signals factories
 * @property {function} setup - the setup function takes a store instance and sets up all signals that are provided by the factory
 */
export interface SignalsFactory {
  readonly setup: (store: Store) => void;
}
