export const effectErrorKind = '$RXS_ERROR';

export type EffectError<E> = {
  kind: typeof effectErrorKind;
  error: E;
};

export const toEffectError = <E>(error: E): EffectError<E> => ({
  kind: effectErrorKind,
  error,
});

export type ToEffectErrorType<T> = T extends EffectError<infer E> ? E : never;

export const isEffectError = <T>(value: any | EffectError<T>): value is EffectError<T> =>
  value?.kind === effectErrorKind;

export const isNotEffectError = <T>(value: T | EffectError<any>): value is T =>
  !isEffectError(value);

export type ToEffectError<E> = E extends never ? never : EffectError<E>;

export type EffectResult<T, E> = T | ToEffectError<E>;
