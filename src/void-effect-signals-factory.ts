import { map, mergeMap, of, switchMap, take, throwError } from 'rxjs';
import { catchError, filter, pairwise, startWith } from 'rxjs/operators';
import { EffectError } from './effect-signals-factory';
import { Signals, SignalsFactory } from './signals-factory';
import { Store } from './store';
import { EffectId, EventId, NO_VALUE, getEffectId, getEventId, getStateId } from './store-utils';

/**
 * Type specifying the input for {@link VoidEffectSignals}
 *
 * @template Input - specifies the input type for the effect
 */
export type VoidEffectInputSignals<Input> = {
  /** The corresponding event-stream will be subscribed eagerly, keeping the effect alive until the stream completes */
  inputEvent: EventId<Input>;
};

/**
 * Type specifying the output for {@link VoidEffectSignals}
 *
 * @template Input - specifies the input type for the effect
 */
export type VoidEffectOutputSignals<Input> = {
  /** Produced error events */
  errors: EventId<EffectError<Input>>;
};

/**
 * Type specifying the effect-type for {@link VoidEffectSignals} (the corresponding effects are NOT added to the store
 * by the `VoidEffectSignals::setup`, but by whoever uses the signals.
 *
 * @template Input - specifies the input type for the effect
 */
export type VoidEffectFactoryEffects<Input> = {
  voidEffect: EffectId<Input, void>;
};

/**
 * This type specifies generic void effect signals. `VoidEffectSignals` can be used to subscribe an `Effect<Input, void` on an input-event.
 * (This will be an eager subscription!)
 *
 * @template Input - specifies the input type for the effect
 */
export type VoidEffectSignals<Input> = Signals<
  VoidEffectInputSignals<Input>,
  VoidEffectOutputSignals<Input>,
  VoidEffectFactoryEffects<Input>
>;

/**
 * This type specifies the type of the argument to {@link VoidEffectSignalsBuild}, hence the configuration of {@link VoidEffectSignals}.
 */
export type VoidEffectConfiguration = {
  /** If defined and `>0`, then it will be used as milliseconds to debounce new input to the effect */
  effectDebounceTime?: number;

  /** Optional string to be used as argument to calls of `getBehaviorId` and `getEventId` */
  nameExtension?: string;
};

/**
 * Type specifying the {@link SignalsBuild} function for {@link VoidEffectSignals}, hence a function taking a {@link VoidEffectConfiguration} and producing {@link VoidEffectSignals}.
 *
 * @template Input - specifies the input type for the effect
 * @param {VoidEffectConfiguration} config - the configuration for the `VoidEffectSignals`
 */
export type VoidEffectSignalsBuild = <Input>(
  config: VoidEffectConfiguration,
) => VoidEffectSignals<Input>;

const voidEffectNoValue = '$INTERNAL_NV_VE$' as const;
type VoidEffectNoValueType = typeof voidEffectNoValue;
const isNotVoidEffectNoValueType = <T>(value: T | VoidEffectNoValueType): value is T =>
  value !== voidEffectNoValue;
const isWithITEvent = <T>(value: {
  event: T | VoidEffectNoValueType;
  prevInput: T | VoidEffectNoValueType;
}): value is { event: T; prevInput: T | VoidEffectNoValueType } =>
  isNotVoidEffectNoValueType(value.event);

const getVoidEffectBuilder: VoidEffectSignalsBuild = <IT>(
  config: VoidEffectConfiguration,
): VoidEffectSignals<IT> => {
  const voidEffect = getEffectId<IT, void>();
  const inputEvent = getEventId<IT>(`${config.nameExtension ?? ''}_input`);
  const errors = getEventId<EffectError<IT>>(`${config.nameExtension ?? ''}_errors`);
  const setup = (store: Store) => {
    const internalInputState = getStateId<VoidEffectNoValueType | IT>();
    const internalInputStateEvent = getEventId<VoidEffectNoValueType | IT>();
    store.addState(internalInputState, voidEffectNoValue);
    store.addReducer(internalInputState, internalInputStateEvent, (_, e) => e);
    store.add2TypedEventSource(
      errors,
      internalInputStateEvent,
      store.getEffect(voidEffect).pipe(
        take(1),
        switchMap(eff =>
          store.getEventStream(inputEvent).pipe(
            startWith(voidEffectNoValue),
            // map((event): { event: IT | VoidEffectNoValueType } => ({ event })),
            pairwise(),
            map(pair => ({
              event: pair[1],
              prevInput: pair[0],
            })),
            filter(isWithITEvent),
            // map(([event, prevInput]: [IT, IT | VoidEffectNoValueType]) => ({
            //   event,
            //   prevInput: isNotVoidEffectNoValueType(prevInput) ? prevInput : NO_VALUE,
            // })),
            mergeMap(e =>
              of(e).pipe(
                switchMap(({ event, prevInput }) => {
                  try {
                    return eff(
                      event,
                      store,
                      isNotVoidEffectNoValueType(prevInput) ? prevInput : NO_VALUE,
                      NO_VALUE,
                    );
                  } catch (error) {
                    return throwError(() => error);
                  }
                }),
                map(() => ({
                  type: internalInputStateEvent,
                  event: e.event,
                })),
                catchError(error =>
                  of({
                    type: errors,
                    event: {
                      error,
                      errorInput: e.event,
                    },
                  }),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  };
  return {
    setup,
    input: {
      inputEvent,
    },
    output: {
      errors,
    },
    effects: {
      voidEffect,
    },
  };
};

/**
 * This type specifies a {@link SignalsFactory} wrapping {@link VoidEffectSignals}.
 *
 * @template Input - specifies the input type for the effect
 */
export type VoidEffectSignalsFactory<Input> = SignalsFactory<
  VoidEffectInputSignals<Input>,
  VoidEffectOutputSignals<Input>,
  VoidEffectConfiguration,
  VoidEffectFactoryEffects<Input>
>;

/**
 * This function creates a {@link VoidEffectSignalsFactory}.
 * ATTENTION: The store will subscribe the input event eagerly and thus, keep effect and code referenced by
 * the effect alive until the input event-source completes! So you must take care to complete the input,
 * if the effect should stop working and code it depends on should become available for GC.
 *
 * @template Input - specifies the input type for the effect
 * @returns {VoidEffectSignalsFactory<Input>}
 */
export const getVoidEffectSignalsFactory = <Input>(): VoidEffectSignalsFactory<Input> =>
  new SignalsFactory<
    VoidEffectInputSignals<Input>,
    VoidEffectOutputSignals<Input>,
    VoidEffectConfiguration,
    VoidEffectFactoryEffects<Input>
  >(getVoidEffectBuilder);
