/**
 * The kind for all {@link EffectError} values.
 */
export const effectErrorKind = '$RXS_ERROR';

/**
 * Representing the error-case of an {@link EffectResult}
 */
export type EffectError<E> = {
  kind: typeof effectErrorKind;
  error: E;
};

/**
 * A factory for {@link EffectError}
 */
export const toEffectError = <E>(error: E): EffectError<E> => ({
  kind: effectErrorKind,
  error,
});

/**
 * Get the concrete error-type of an {@link EffectError}
 */
export type ToEffectErrorType<T> = T extends EffectError<infer E> ? E : never;

/**
 * Typeguard to check if {@link EffectError}
 */
export const isEffectError = <T>(value: any | EffectError<T>): value is EffectError<T> =>
  value?.kind === effectErrorKind;

/**
 * Typeguard to check if not {@link EffectError}
 */
export const isNotEffectError = <T, E, X extends EffectResult<T, E>>(
  value: X,
): value is Exclude<X, EffectError<E>> => !isEffectError(value);

/**
 * Map from concrete error-type to `EffectError`.
 * Everything except for never will be wrapped to an `EffectError`
 */
export type ToEffectError<E> = E extends never ? never : EffectError<E>;

/**
 * The result type for rx-signals effects, representing result-type `T` or effect-error `EffectError<E>`.
 * If `E extends never`, `EffectResult<T, E>` will be `T`.
 */
export type EffectResult<T, E> = T | ToEffectError<E>;
