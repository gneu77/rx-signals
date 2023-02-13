import {
  BehaviorSubject,
  NEVER,
  Observable,
  asyncScheduler,
  delay,
  distinctUntilChanged,
  filter,
  firstValueFrom,
  map,
  merge,
  of,
  share,
  switchMap,
  take,
  withLatestFrom,
} from 'rxjs';
import { ControlledSubject } from './controlled-subject';
import { DelayedEventQueue } from './delayed-event-queue';
import { SourceObservable } from './source-observable';
import {
  BehaviorId,
  DerivedId,
  EffectId,
  EventId,
  NO_VALUE,
  NoValueType,
  SignalId,
  StateId,
  ToBehaviorIdValueType,
  ToEventIdValueType,
  ToSignalIdValueType,
  isBehaviorId,
  isDerivedId,
  isStateId,
} from './store-utils';

/**
 * The {@link Store} uses the TypedEvent\<T\> to bundle certain events and their
 * corresponding EventId\<T\>. This is used for EventSources that can dispatch events
 * of different types (see addXTypedEventSource methods) or for cases where you want to
 * subscribe multiple events and need to differentiate between them at runtime.
 *
 * @template T - specifies the type for the corresponding event-values
 */
export type TypedEvent<T> = Readonly<{
  type: EventId<T>;
  event: T;
}>;

/**
 * The state reducer type specifies the signature for reducers used by the {@link Store}.
 * StateReducers must be pure functions.
 *
 * @template T - representing the type of the state
 * @template E - representing the type of the event
 */
export type StateReducer<T, E> = (state: T, event: E) => T;

/**
 * A LifecycleHandle can be used to control signals and signal-sources that
 * are added to the {@link Store} by store.getLifecycleHandle
 */
export type LifecycleHandle = {
  /** reset all behaviors corresponding to this lifecycle */
  reset: () => void;

  /** reset all behaviors corresponding to this lifecycle */
  end: () => void;
};

/**
 * The Effect type specifies a potentially impure function that takes an input and a {@link Store} as arguments
 * and returns an effectful result as Observable.
 * It is the low-level abstraction used by rx-signals for side-effect isolation.
 * The high-level abstraction {@link EffectSignalsFactory} takes an EffectId as configuration to access
 * the corresponding Effect.
 * The store argument can be used to access additional input from the store (thus, the Effect itself could also
 * be pure and just use something impure that was put into the store, e.g. another Effect).
 * The previousInput argument can be used e.g. to decide whether the effect must perform
 * a computation/query/etc., or if maybe the previousResult can be returned directly.
 *
 * @template Input - specifies the input type for the effect
 * @template Result - specifies the result type for the effect
 */
export type Effect<Input, Result> = (
  /** the effect input */
  input: Input,

  /** the Store instance that will be passed to the function (e.g. to inject some other Effect) */
  store: Store,

  /** the input of the previous function invocation, or NO_VALUE */
  previousInput: Input | NoValueType,

  /** the result of the previous function invocation, or NO_VALUE */
  previousResult: Result | NoValueType,
) => Observable<Result>;

/**
 * ToEffectType is a utility type to get the corresponding Effect type
 * from a given EffectId type.
 *
 * @template ID - a concrete EffectId type
 */
export type ToEffectType<ID> = ID extends EffectId<infer I, infer O> ? Effect<I, O> : never;

/**
 * The rx-signals Store provides RxJs-Observables for RP (reactive programming) - BehaviorStreams
 * and EventStreams (behaviors and events are the two different types of signals, where behaviors represent immutable state).
 * The Store separates the sources of these streams from the streams itself.
 *
 * @class Store
 */
export class Store {
  private delayedEventQueue = new DelayedEventQueue();

  private readonly behaviors = new Map<symbol, ControlledSubject<any>>();

  private readonly eventStreams = new Map<symbol, ControlledSubject<any>>();

  private readonly behaviorsSubject = new BehaviorSubject<Map<symbol, ControlledSubject<any>>>(
    new Map<symbol, ControlledSubject<any>>(),
  );

  private readonly eventStreamsSubject = new BehaviorSubject<Map<symbol, ControlledSubject<any>>>(
    new Map<symbol, ControlledSubject<any>>(),
  );

  private readonly names = new Map<symbol, string>();

  private parentStore: Store | null = null;

  private currentLifecycleObjects: null | { behaviors: symbol[]; events: symbol[] } = null;

  /**
   * Get the parent store of this store, or null in case it has no parent store.
   *
   * @returns {Store | null}
   */
  getParentStore(): Store | null {
    return this.parentStore ?? null;
  }

  /**
   * Get the root store of this store, in case this store is a child store in a hierarchy of parent-child stores.
   * Returns itself, if this store has no parent.
   *
   * @returns {Store}
   */
  getRootStore(): Store {
    let result: Store = this;
    while (result.parentStore) {
      result = result.parentStore;
    }
    return result;
  }

  /**
   * Create and return a child store of this store. Event-subscribers of the child store will receive
   * events from the parent (and its parents) and their own events (see getEventStream). However,
   * events dispatched on the child will not propagate to the parent. The child will use the same event
   * queue as the parent to ensure correct event order even between parent-child boundaries.
   * Behavior-subscribers of the child will receive the observable from the parent, as long as no
   * corresponding behavior source is added to the child. It will switch to the child, once a source is
   * added there (see getBehavior).
   *
   * @returns {Store}
   */
  createChildStore(): Store {
    const childStore = new Store();
    childStore.parentStore = this;
    childStore.delayedEventQueue = this.delayedEventQueue;
    return childStore;
  }

  // This method was public in pre-3.0.0-rc22 versions, however, distinction between
  // lazy and eager subscriptions becomes much clearer and less error-prone, when
  // differentiating between StateId and DerivedId, which I introduced with 3.0.0-rc22.
  // Thus, to protect users from misusage, I made this low-level method private.
  private addBehavior<ID extends BehaviorId<any>>(
    identifier: ID,
    observable: Observable<ToBehaviorIdValueType<ID>>,
    subscribeLazy: boolean,
    initialValueOrValueGetter:
      | ToBehaviorIdValueType<ID>
      | (() => ToBehaviorIdValueType<ID>)
      | NoValueType = NO_VALUE,
  ): void {
    this.assertSourceExists(identifier, identifier);
    this.getBehaviorControlledSubject(identifier).addSource(
      new SourceObservable<ToBehaviorIdValueType<ID>>(
        identifier,
        observable,
        subscribeLazy,
        initialValueOrValueGetter,
      ),
    );
    if (this.parentStore) {
      // to trigger behavior-switch in child-stores (see getBehavior):
      this.behaviorsSubject.next(this.behaviors);
    }
    if (this.currentLifecycleObjects !== null) {
      this.currentLifecycleObjects.behaviors.push(identifier);
    }
  }

  /**
   * This adds an observable representing derived state, hence state that
   * depends on other behaviors, to the store.
   * The store will not eagerly subscribe the given observable.
   * While derived state usually depends on other Behaviors and not on events, there are still
   * valid use-cases where the given observable might depend on an event.
   * E.g., if you want to transform an event-stream into a lazily-subscribed behavior (However, the
   * more idiomatic way to do this would be to use the connect method instead.).
   *
   * @param {DerivedId<T>} identifier - the unique identifier for the derived-state behavior
   * @param {Observable<T>} observable - the source for the behavior
   * @param {T | (() => T) | symbol} initialValueOrValueGetter - the initial value or value getter (for lazy initialization) or symbol NO_VALUE, if there is no initial value (default)
   * @throws if a state for the given identifier has already been added to this Store
   * @returns {void}
   */
  addDerivedState<ID extends DerivedId<any>>(
    identifier: ID,
    observable: Observable<ToBehaviorIdValueType<ID>>,
    initialValueOrValueGetter:
      | ToBehaviorIdValueType<ID>
      | (() => ToBehaviorIdValueType<ID>)
      | NoValueType = NO_VALUE,
  ): void {
    this.addBehavior(identifier, observable, true, initialValueOrValueGetter);
  }

  /**
   * This method adds a source for the state specified by the given identifier, that provides the
   * given value as initial value for the corresponding behavior.
   * It will be the only value, as long as no reducer is added.
   * Use this for root-state only, hence state that only depends on events, but not on any other behavior.
   * The store will eagerly subscribe all reducers being added for the state.
   * If one of those reducers depends on an event-source that should be lazy, this situation
   * can be solved using one of the addXTypedEventSource methods (see corresponding documentation) for the
   * corresponding event-source.
   *
   * @param {StateId<T>} identifier - the unique identifier for the root-state behavior
   * @param {T | (() => T)} initialValueOrValueGetter - the initial value or value getter
   * @throws if a state for the given identifier has already been added to this Store
   * @returns {void}
   */
  addState<ID extends StateId<any>>(
    identifier: ID,
    initialValueOrValueGetter: ToBehaviorIdValueType<ID> | (() => ToBehaviorIdValueType<ID>),
  ): void {
    this.assertSourceExists(identifier, identifier);
    this.getBehaviorControlledSubject(identifier).addSource(
      new SourceObservable<ToBehaviorIdValueType<ID>>(
        identifier,
        NEVER,
        false,
        initialValueOrValueGetter,
      ),
    );
    if (this.currentLifecycleObjects !== null) {
      this.currentLifecycleObjects.behaviors.push(identifier);
    }
  }

  /**
   * This adds a reducer to a behavior. This is meant to be used together with the addState method.
   * The corresponding event will be subscribed eagerly by the store.
   * If the event comes from an event-source that should be lazy, this situation
   * can be solved using one of the addXTypedEventSource methods (see corresponding documentation) for this
   * event-source (another solution would be to switchMap the event-source depending on whatever condition).
   *
   * @param {StateId<T>} stateIdentifier - the unique identifier for the root-state behavior
   * @param {EventId<T>} eventIdentifier - the unique identifier for the event reducing the state
   * @param {StateReducer<T, E>} reducer - pure function that takes the previous state and the event and returns a new state
   * @returns {void}
   */
  addReducer<SID extends StateId<any>, EID extends EventId<any>>(
    stateIdentifier: SID,
    eventIdentifier: EID,
    reducer: StateReducer<ToBehaviorIdValueType<SID>, ToEventIdValueType<EID>>,
  ): void {
    const sourceObservable = this.getEventStream(eventIdentifier).pipe(
      withLatestFrom(this.getBehavior(stateIdentifier)),
      map(([event, state]) => reducer(state, event)),
    );
    this.getBehaviorControlledSubject(stateIdentifier).addSource(
      new SourceObservable<ToBehaviorIdValueType<SID>>(eventIdentifier, sourceObservable, false),
    );
  }

  /**
   * This method can be used to remove a reducer from a root-state behavior.
   *
   * @param {StateId<T>} stateIdentifier - the unique identifier for the root-state behavior
   * @param {EventId<T>} eventIdentifier - the unique identifier for the event the reducer is handling
   * @returns {void}
   */
  removeReducer<T, E>(stateIdentifier: StateId<T>, eventIdentifier: EventId<E>): void {
    this.getBehaviorControlledSubject(stateIdentifier).removeSource(eventIdentifier);
  }

  /**
   * The connect method takes a source- and a target-ID and adds a corresponding source for the targetId
   * to the store, connecting the source event or behavior with the target event or behavior.
   * Thus, if targetId is a BehaviorId, a source must not yet exist in the store, else this method will throw a corresponding error!
   *
   * @param {SignalId<S extends T>} sourceId - the unique identifier for the source event or behavior
   * @param {SignalId<T>} targetId - the unique identifier for the target event or behavior
   * @throws if targetId is a BehaviorId and already exists in this Store
   * @returns {void | symbol} - symbol of the added event source in case the targetId is an EventId, else void
   */
  connect<TID extends SignalId<any>, S extends ToSignalIdValueType<TID>>(
    sourceId: SignalId<S>,
    targetId: TID,
  ): TID extends BehaviorId<ToSignalIdValueType<TID>> ? void : symbol {
    // We must use <TID extends SignalId, S extends ToSignalIdValueType<TID>>,
    // because for some reason, TS does not enforce S extends T, if we
    // use <T, S extends T, TID extends SignalId> (which it should in my opinion)
    const source = isBehaviorId(sourceId)
      ? this.getBehavior(sourceId as BehaviorId<S>)
      : this.getEventStream(sourceId as EventId<S>);
    return this.connectObservable(source, targetId);
  }

  /**
   * This connects the source observable with the target event or behavior.
   * If the targetId is a BehaviorId, a corresponding behavior source will be added
   * to the store.
   * If the targetId is an EventId, a corresponding EventSource will be added to the store.
   * Hence, if targetId is a BehaviorId, it must not yet exist in the store, else this method will throw a corresponding error!
   *
   * @param {Observable<S extends T>} source - the source observable
   * @param {SignalId<T>} targetId - the unique identifier for the target event or behavior
   * @throws if targetId is a BehaviorId and already exists in this Store
   * @returns {void | symbol} - symbol of the added event source in case the targetId is an EventId, else void
   */
  connectObservable<TID extends SignalId<any>, S extends ToSignalIdValueType<TID>>(
    source: Observable<S>,
    targetId: TID,
  ): TID extends BehaviorId<ToSignalIdValueType<TID>> ? void : symbol {
    if (isDerivedId(targetId)) {
      return this.addDerivedState(
        targetId as DerivedId<ToSignalIdValueType<TID>>,
        source,
      ) as TID extends BehaviorId<ToSignalIdValueType<TID>> ? void : symbol;
    }
    if (isStateId(targetId)) {
      return this.addBehavior(
        targetId as BehaviorId<ToSignalIdValueType<TID>>,
        source,
        false,
      ) as TID extends BehaviorId<ToSignalIdValueType<TID>> ? void : symbol;
    }
    return this.addEventSource(
      targetId as EventId<ToSignalIdValueType<TID>>,
      source,
    ) as TID extends BehaviorId<ToSignalIdValueType<TID>> ? void : symbol;
  }

  /**
   * This method removes all sources for a behavior.
   * (Yes, from the API-point-of-view, there can be only one source for a behavior. However, technically
   *  each reducer added for a root-state-behavior also represents a source.)
   *
   * @param {BehaviorId<T>} identifier - the unique identifier for the behavior
   * @returns {void}
   */
  removeBehaviorSources<T>(identifier: BehaviorId<T>): void {
    const behavior = this.getBehaviorControlledSubject(identifier);
    behavior.removeAllSources();
  }

  /**
   * This method removes all sources for a behavior and then completes the behavior for all
   * current subscribers and removes it from the store.
   *
   * @param {BehaviorId<T>} identifier - the unique identifier for the behavior
   * @returns {void}
   */
  completeBehavior<T>(identifier: BehaviorId<T>): void {
    const behavior = this.getBehaviorControlledSubject(identifier);
    behavior.removeAllSources();
    behavior.complete();
    this.behaviors.delete(identifier);
    this.names.delete(identifier);
    this.behaviorsSubject.next(this.behaviors);
  }

  /**
   * This method removes all sources for all behaviors and all event
   * streams and then completes them for all current subscribers and removes them
   * from the store.
   * This method should be used to end a stores lifetime (e.g. for a child store), to make
   * sure no non-lazy subscriptions keep the store alife (hence avoiding memory leaks)!
   *
   * @returns {void}
   */
  completeAllSignals(): void {
    [...this.behaviors.keys()].forEach(key => {
      const behavior = this.behaviors.get(key);
      behavior?.removeAllSources();
      behavior?.complete();
      this.behaviors.delete(key);
      this.names.delete(key);
    });
    [...this.eventStreams.keys()].forEach(key => {
      const eventStream = this.eventStreams.get(key);
      eventStream?.removeAllSources();
      eventStream?.complete();
      this.eventStreams.delete(key);
      this.names.delete(key);
    });
    this.behaviorsSubject.next(this.behaviors);
    this.eventStreamsSubject.next(this.eventStreams);
  }

  /**
   * This method takes a callback that performs Store operations.
   * It returns a {@link LifecycleHandle} that can be used to reset or end the lifecycle of signals
   * and signal-sources that are added to the store during the callback execution.
   *
   * @param {function} lifecycleRegistrationCallback - behaviors and event-sources added within this callback will be part of the lifecycle
   * @throws if this method is called while already inside another lifecycleRegistrationCallback for this Store
   * @returns {LifecycleHandle}
   */
  getLifecycleHandle(lifecycleRegistrationCallback: (store: Store) => void): LifecycleHandle {
    if (this.currentLifecycleObjects !== null) {
      throw new Error(
        'getLifecycleHandle cannot be called while already within a lifecycleRegistrationCallback',
      );
    }
    this.currentLifecycleObjects = {
      behaviors: [],
      events: [],
    };
    try {
      lifecycleRegistrationCallback(this);
    } catch (error) {
      this.currentLifecycleObjects = null;
      throw error;
    }
    let { behaviors, events } = this.currentLifecycleObjects;
    this.currentLifecycleObjects = null;
    return {
      reset: () => {
        const resetHandles = behaviors.map(behavior =>
          this.behaviors.get(behavior)?.getResetHandle(),
        );
        resetHandles.forEach(handle => handle?.removeSources());
        resetHandles.forEach(handle => handle?.readdSources());
        behaviors = [];
      },
      end: () => {
        behaviors.forEach(key => {
          const behavior = this.behaviors.get(key);
          behavior?.removeAllSources();
          behavior?.complete();
          this.behaviors.delete(key);
          this.names.delete(key);
        });
        behaviors = [];
        events.forEach(key => {
          this.removeEventSource(key);
        });
        events = [];
        this.behaviorsSubject.next(this.behaviors);
      },
    };
  }

  /**
   * This method returns the behavior specified by identifier. It does not matter, if a source
   * for the behavior has already been added or not. If a source has already been added, a
   * subscriber will get the latest value from the source. Else, a subscriber will get the
   * initial value, as soon as a source is added.
   * Please note, that all behaviors are shared and distinct value streams (hence you do not
   * have to pipe with distinctUntilChanged and shareReplay yourself). The sharing behaves like
   * shareReplay(1), but WITHOUT the risk of a memory leak that would be possible with shareReplay(1).
   * If this store has a parent store, then as long as no behavior source is added for the child, the
   * behavior will be received from the parent. As soon, as a corresponding source is added to the child,
   * you will receive the behavior values from the child.
   *
   * @param {BehaviorId<T>} identifier - the unique identifier for the behavior
   * @returns {Observable<T>} - the behavior observable (shared and distinct)
   */
  getBehavior<T>(identifier: BehaviorId<T>): Observable<T> {
    if (this.parentStore) {
      const parent: Store = this.parentStore;
      return this.behaviorsSubject
        .asObservable()
        .pipe(
          switchMap(s =>
            (s.get(identifier)?.getNumberOfSources() ?? 0) > 0
              ? this.getBehaviorControlledSubject(identifier).getObservable()
              : parent.getBehavior(identifier),
          ),
        );
    }
    return this.getBehaviorControlledSubject(identifier).getObservable();
  }

  /**
   * This method resets all behaviors, effectively resetting the complete store to the state it
   * had before any event was dispatched.
   * Technically, this is done by first removing all sources and then adding them again.
   */
  resetBehaviors(): void {
    const resetHandles = [...this.behaviors.values()].map(behavior => behavior.getResetHandle());
    resetHandles.forEach(handle => handle.removeSources());
    resetHandles.forEach(handle => handle.readdSources());
  }

  /**
   * This method is used to dispatch an event of the type specified by the given identifier.
   * The only reason for returning a promise instead of directly returning a boolean is to simplify
   * testing (e.g. make sure a dispatch is finished before checking the new state). In real code,
   * awaiting the returned promise would be a severe code smell (dispatching an event is an effect
   * and the only way to know an effect has been finished is to receive a corresponding message,
   * either in form of another event, or in form of a corresponding new state)!
   *
   * @param {EventId<T>} identifier - the unique identifier for the event
   * @param {T} event - the event of the type specified by the identifier (optional in case of void type)
   * @returns {Promise<boolean>} - a promise that resolves to true, if the event was subscribed, else to false
   */
  dispatch(identifier: EventId<undefined>, event?: never): Promise<boolean>; // to make the event optional in case of EventId<undefined>
  dispatch(identifier: EventId<void>, event?: never): Promise<boolean>;
  dispatch<ID extends EventId<any>>(
    identifier: ID,
    event: ToEventIdValueType<ID>,
  ): Promise<boolean>;
  dispatch<ID extends EventId<any>>(
    identifier: ID,
    event: ToEventIdValueType<ID>,
  ): Promise<boolean> {
    const controlledSubject = this.getEventStreamControlledSubject(identifier);
    if (controlledSubject.isObservableSubscribed()) {
      const result: Promise<boolean> = firstValueFrom(
        this.getEventStream(identifier).pipe(
          filter(val => val === event),
          take(1),
          map(() => true),
          delay(1, asyncScheduler),
        ),
      );
      controlledSubject.next(event);
      return result;
    }
    return Promise.resolve(false);
  }

  /**
   * This method adds an event source to the store. There can be multiple sources
   * for the same event type. However, each source must be identified by its own
   * symbol and adding two sources with the same symbol would result in an error.
   * Event sources are effects!
   *
   * @param {EventId<T>} eventIdentifier - the unique identifier for the event
   * @param {Observable<T>} observable - the event source
   * @returns {smybol} - a symbol that can be used to remove the event-source from the store
   */
  addEventSource<ID extends EventId<any>>(
    eventIdentifier: ID,
    observable: Observable<ToEventIdValueType<ID>>,
  ): symbol {
    const sourceId = Symbol('');
    this.getEventStreamControlledSubject(eventIdentifier).addSource(
      new SourceObservable<ToEventIdValueType<ID>>(sourceId, observable, true),
    );
    if (this.currentLifecycleObjects !== null) {
      this.currentLifecycleObjects.events.push(sourceId);
    }
    return sourceId;
  }

  /**
   * In contrast to addEventSource, this method adds an event source to the Store
   * that can dispatch two different event types A and B.
   * If you set the optional parameter subscribeObservableOnlyIfEventIsSubscribed, the whole
   * source will only be subscribed, if the event corresponding to this parameter is subscribed.
   * A common use-case for this would be an effect that dispatches A as result and B as generic
   * error event. If you have a central error handler listening to B, this would normally always
   * subscribe the whole effect (you will listen for errors over the whole lifetime of your app),
   * hence it would make lazy subscription of A impossible. But if you set subscribeObservableOnlyIfEventIsSubscribed
   * to eventIdentifierA, then the whole source will only be subscribed as long as A is subscribed.
   *
   * @param {EventId<A>} eventIdentifierA - the unique identifier for event type A
   * @param {EventId<B>} eventIdentifierB - the unique identifier for event type B
   * @param {Observable<TypedEvent<A> | TypedEvent<B>>} observable - the event source
   * @param {EventId<any> | null} subscribeObservableOnlyIfEventIsSubscribed - defaults to null
   * @returns {smybol} - a symbol that can be used to remove the event-source from the store
   */
  add2TypedEventSource<IDA extends EventId<any>, IDB extends EventId<any>>(
    eventIdentifierA: IDA,
    eventIdentifierB: IDB,
    observable: Observable<
      TypedEvent<ToEventIdValueType<IDA>> | TypedEvent<ToEventIdValueType<IDB>>
    >,
    subscribeObservableOnlyIfEventIsSubscribed: EventId<any> | null = null,
  ): symbol {
    const sourceId = Symbol('');
    const sharedSource = this.getDependentObservable(
      observable.pipe(delay(1, asyncScheduler), share()),
      subscribeObservableOnlyIfEventIsSubscribed,
    );
    this.addTypedEventSource(
      sourceId,
      eventIdentifierA,
      sharedSource as Observable<TypedEvent<ToEventIdValueType<IDA>>>,
    );
    this.addTypedEventSource(
      sourceId,
      eventIdentifierB,
      sharedSource as Observable<TypedEvent<ToEventIdValueType<IDB>>>,
    );
    if (this.currentLifecycleObjects !== null) {
      this.currentLifecycleObjects.events.push(sourceId);
    }
    return sourceId;
  }

  /**
   * See add2TypedEventSource
   *
   * @param {EventId<A>} eventIdentifierA - the unique identifier for event type A
   * @param {EventId<B>} eventIdentifierB - the unique identifier for event type B
   * @param {EventId<C>} eventIdentifierC - the unique identifier for event type C
   * @param {Observable<TypedEvent<A> | TypedEvent<B> | TypedEvent<C>>} observable - the event source
   * @param {EventId<any> | null} subscribeObservableOnlyIfEventIsSubscribed - defaults to null
   * @returns {smybol} - a symbol that can be used to remove the event-source from the store
   */
  add3TypedEventSource<
    IDA extends EventId<any>,
    IDB extends EventId<any>,
    IDC extends EventId<any>,
  >(
    eventIdentifierA: IDA,
    eventIdentifierB: IDB,
    eventIdentifierC: IDC,
    observable: Observable<
      | TypedEvent<ToEventIdValueType<IDA>>
      | TypedEvent<ToEventIdValueType<IDB>>
      | TypedEvent<ToEventIdValueType<IDC>>
    >,
    subscribeObservableOnlyIfEventIsSubscribed: EventId<any> | null = null,
  ): symbol {
    const sourceId = Symbol('');
    const sharedSource = this.getDependentObservable(
      observable.pipe(delay(1, asyncScheduler), share()),
      subscribeObservableOnlyIfEventIsSubscribed,
    );
    this.addTypedEventSource(
      sourceId,
      eventIdentifierA,
      sharedSource as Observable<TypedEvent<ToEventIdValueType<IDA>>>,
    );
    this.addTypedEventSource(
      sourceId,
      eventIdentifierB,
      sharedSource as Observable<TypedEvent<ToEventIdValueType<IDB>>>,
    );
    this.addTypedEventSource(
      sourceId,
      eventIdentifierC,
      sharedSource as Observable<TypedEvent<ToEventIdValueType<IDC>>>,
    );
    if (this.currentLifecycleObjects !== null) {
      this.currentLifecycleObjects.events.push(sourceId);
    }
    return sourceId;
  }

  /**
   * See add2TypedEventSource
   *
   * @param {EventId<A>} eventIdentifierA - the unique identifier for event type A
   * @param {EventId<B>} eventIdentifierB - the unique identifier for event type B
   * @param {EventId<C>} eventIdentifierC - the unique identifier for event type C
   * @param {EventId<D>} eventIdentifierD - the unique identifier for event type D
   * @param {Observable<TypedEvent<A> | TypedEvent<B> | TypedEvent<C> | TypedEvent<D>>} observable - the event source
   * @param {EventId<any> | null} subscribeObservableOnlyIfEventIsSubscribed - defaults to null
   * @returns {smybol} - a symbol that can be used to remove the event-source from the store
   */
  add4TypedEventSource<
    IDA extends EventId<any>,
    IDB extends EventId<any>,
    IDC extends EventId<any>,
    IDD extends EventId<any>,
  >(
    eventIdentifierA: IDA,
    eventIdentifierB: IDB,
    eventIdentifierC: IDC,
    eventIdentifierD: IDD,
    observable: Observable<
      | TypedEvent<ToEventIdValueType<IDA>>
      | TypedEvent<ToEventIdValueType<IDB>>
      | TypedEvent<ToEventIdValueType<IDC>>
      | TypedEvent<ToEventIdValueType<IDD>>
    >,
    subscribeObservableOnlyIfEventIsSubscribed: EventId<any> | null = null,
  ): symbol {
    const sourceId = Symbol('');
    const sharedSource = this.getDependentObservable(
      observable.pipe(delay(1, asyncScheduler), share()),
      subscribeObservableOnlyIfEventIsSubscribed,
    );
    this.addTypedEventSource(
      sourceId,
      eventIdentifierA,
      sharedSource as Observable<TypedEvent<ToEventIdValueType<IDA>>>,
    );
    this.addTypedEventSource(
      sourceId,
      eventIdentifierB,
      sharedSource as Observable<TypedEvent<ToEventIdValueType<IDB>>>,
    );
    this.addTypedEventSource(
      sourceId,
      eventIdentifierC,
      sharedSource as Observable<TypedEvent<ToEventIdValueType<IDC>>>,
    );
    this.addTypedEventSource(
      sourceId,
      eventIdentifierD,
      sharedSource as Observable<TypedEvent<ToEventIdValueType<IDD>>>,
    );
    if (this.currentLifecycleObjects !== null) {
      this.currentLifecycleObjects.events.push(sourceId);
    }
    return sourceId;
  }

  /**
   * See add2TypedEventSource
   *
   * @param {EventId<A>} eventIdentifierA - the unique identifier for event type A
   * @param {EventId<B>} eventIdentifierB - the unique identifier for event type B
   * @param {EventId<C>} eventIdentifierC - the unique identifier for event type C
   * @param {EventId<D>} eventIdentifierD - the unique identifier for event type D
   * @param {EventId<E>} eventIdentifierE - the unique identifier for event type E
   * @param {Observable<TypedEvent<A> | TypedEvent<B> | TypedEvent<C> | TypedEvent<D> | TypedEvent<E>>} observable - the event source
   * @param {EventId<any> | null} subscribeObservableOnlyIfEventIsSubscribed - defaults to null
   * @returns {smybol} - a symbol that can be used to remove the event-source from the store
   */
  add5TypedEventSource<
    IDA extends EventId<any>,
    IDB extends EventId<any>,
    IDC extends EventId<any>,
    IDD extends EventId<any>,
    IDE extends EventId<any>,
  >(
    eventIdentifierA: IDA,
    eventIdentifierB: IDB,
    eventIdentifierC: IDC,
    eventIdentifierD: IDD,
    eventIdentifierE: IDE,
    observable: Observable<
      | TypedEvent<ToEventIdValueType<IDA>>
      | TypedEvent<ToEventIdValueType<IDB>>
      | TypedEvent<ToEventIdValueType<IDC>>
      | TypedEvent<ToEventIdValueType<IDD>>
      | TypedEvent<ToEventIdValueType<IDE>>
    >,
    subscribeObservableOnlyIfEventIsSubscribed: EventId<any> | null = null,
  ): symbol {
    const sourceId = Symbol('');
    const sharedSource = this.getDependentObservable(
      observable.pipe(delay(1, asyncScheduler), share()),
      subscribeObservableOnlyIfEventIsSubscribed,
    );
    this.addTypedEventSource(
      sourceId,
      eventIdentifierA,
      sharedSource as Observable<TypedEvent<ToEventIdValueType<IDA>>>,
    );
    this.addTypedEventSource(
      sourceId,
      eventIdentifierB,
      sharedSource as Observable<TypedEvent<ToEventIdValueType<IDB>>>,
    );
    this.addTypedEventSource(
      sourceId,
      eventIdentifierC,
      sharedSource as Observable<TypedEvent<ToEventIdValueType<IDC>>>,
    );
    this.addTypedEventSource(
      sourceId,
      eventIdentifierD,
      sharedSource as Observable<TypedEvent<ToEventIdValueType<IDD>>>,
    );
    this.addTypedEventSource(
      sourceId,
      eventIdentifierE,
      sharedSource as Observable<TypedEvent<ToEventIdValueType<IDE>>>,
    );
    if (this.currentLifecycleObjects !== null) {
      this.currentLifecycleObjects.events.push(sourceId);
    }
    return sourceId;
  }

  /**
   * See add2TypedEventSource
   *
   * @param {EventId<A>} eventIdentifierA - the unique identifier for event type A
   * @param {EventId<B>} eventIdentifierB - the unique identifier for event type B
   * @param {EventId<C>} eventIdentifierC - the unique identifier for event type C
   * @param {EventId<D>} eventIdentifierD - the unique identifier for event type D
   * @param {EventId<E>} eventIdentifierE - the unique identifier for event type E
   * @param {EventId<F>} eventIdentifierF - the unique identifier for event type F
   * @param {Observable<TypedEvent<A> | TypedEvent<B> | TypedEvent<C> | TypedEvent<D> | TypedEvent<E> | TypedEvent<F>>} observable - the event source
   * @param {EventId<any> | null} subscribeObservableOnlyIfEventIsSubscribed - defaults to null
   * @returns {smybol} - a symbol that can be used to remove the event-source from the store
   */
  add6TypedEventSource<
    IDA extends EventId<any>,
    IDB extends EventId<any>,
    IDC extends EventId<any>,
    IDD extends EventId<any>,
    IDE extends EventId<any>,
    IDF extends EventId<any>,
  >(
    eventIdentifierA: IDA,
    eventIdentifierB: IDB,
    eventIdentifierC: IDC,
    eventIdentifierD: IDD,
    eventIdentifierE: IDE,
    eventIdentifierF: IDF,
    observable: Observable<
      | TypedEvent<ToEventIdValueType<IDA>>
      | TypedEvent<ToEventIdValueType<IDB>>
      | TypedEvent<ToEventIdValueType<IDC>>
      | TypedEvent<ToEventIdValueType<IDD>>
      | TypedEvent<ToEventIdValueType<IDE>>
      | TypedEvent<ToEventIdValueType<IDF>>
    >,
    subscribeObservableOnlyIfEventIsSubscribed: EventId<any> | null = null,
  ): symbol {
    const sourceId = Symbol('');
    const sharedSource = this.getDependentObservable(
      observable.pipe(delay(1, asyncScheduler), share()),
      subscribeObservableOnlyIfEventIsSubscribed,
    );
    this.addTypedEventSource(
      sourceId,
      eventIdentifierA,
      sharedSource as Observable<TypedEvent<ToEventIdValueType<IDA>>>,
    );
    this.addTypedEventSource(
      sourceId,
      eventIdentifierB,
      sharedSource as Observable<TypedEvent<ToEventIdValueType<IDB>>>,
    );
    this.addTypedEventSource(
      sourceId,
      eventIdentifierC,
      sharedSource as Observable<TypedEvent<ToEventIdValueType<IDC>>>,
    );
    this.addTypedEventSource(
      sourceId,
      eventIdentifierD,
      sharedSource as Observable<TypedEvent<ToEventIdValueType<IDD>>>,
    );
    this.addTypedEventSource(
      sourceId,
      eventIdentifierE,
      sharedSource as Observable<TypedEvent<ToEventIdValueType<IDE>>>,
    );
    this.addTypedEventSource(
      sourceId,
      eventIdentifierF,
      sharedSource as Observable<TypedEvent<ToEventIdValueType<IDF>>>,
    );
    if (this.currentLifecycleObjects !== null) {
      this.currentLifecycleObjects.events.push(sourceId);
    }
    return sourceId;
  }

  /**
   * This method removes the specified event source.
   *
   * @param {symbol} sourceIdentifier - the unique identifier for the event source
   * @returns {void}
   */
  removeEventSource(sourceIdentifier: symbol): void {
    this.eventStreams.forEach(cs => cs.removeSource(sourceIdentifier));
  }

  /**
   * This method returns an observable for events of the specified type.
   * Please note, that all observables for the same identifier are already piped with delay(1, asyncScheduler)
   * and share(). So events will always be received asynchronously (expecting synchronous event dispatch would
   * be a strong indicator of flawed design, because it could break reactivity).
   * If this store has a parent store, events from both, parent and child will be observed (merged).
   *
   * @param {EventId<T>} identifier - the unique identifier for the event
   * @returns {Observable<T>} - the behavior observable for the events (piped with delay(1, asyncScheduler) and share())
   */
  getEventStream<T>(identifier: EventId<T>): Observable<T> {
    return merge(
      this.getEventStreamControlledSubject(identifier).getObservable(),
      this.parentStore ? this.parentStore.getEventStream(identifier) : NEVER,
    );
  }

  /**
   * Like getEventStream, but receiving TypedEvent<T> instead of T.
   *
   * @param {EventId<T>} identifier - the unique identifier for the event
   * @returns {Observable<TypedEvent<T>>} - the observable for the typed events
   */
  getTypedEventStream<T>(identifier: EventId<T>): Observable<TypedEvent<T>> {
    return merge(
      this.getEventStreamControlledSubject(identifier)
        .getObservable()
        .pipe(
          map(event => ({
            type: identifier,
            event,
          })),
        ),
      this.parentStore ? this.parentStore.getTypedEventStream(identifier) : NEVER,
    );
  }

  /**
   * This method adds an Effect to the store.
   *
   * @param {ID} id - the unique identifier for the effect
   * @param {ToEffectType<ID>} effect - the Effect function
   * @returns {void}
   */
  addEffect<ID extends EffectId<any, any>>(id: ID, effect: ToEffectType<ID>): void {
    this.addState(id as unknown as StateId<ToEffectType<ID>>, () => effect);
  }

  /**
   * This method returns an Observable for the effect specified by identifier.
   * It does not matter, if the effect has already been added or not.
   * If it has already been added, a subscriber will get it immediately. Else, a subscriber will
   * get the effect as soon as it is added to the store.
   * If this store has a parent store, then as long as no effect is added for the child, the
   * effect will be received from the parent. As soon, as a corresponding effect is added to the child,
   * subscribers will receive the effect from the child.
   *
   * @param {EffectId<InputType, ResultType>} id - the unique identifier for the effect
   * @returns {Observable<Effect<InputType, ResultType>>} - the effect observable
   */
  getEffect<InputType, ResultType>(
    id: EffectId<InputType, ResultType>,
  ): Observable<Effect<InputType, ResultType>> {
    return this.getBehavior<Effect<InputType, ResultType>>(
      id as unknown as BehaviorId<Effect<InputType, ResultType>>,
    );
  }

  /**
   * The isSubscribed method is a convenience method for testing and debugging and should
   * not serve any purpose in real program logic.
   *
   * @param {SignalId<T>} identifier - the unique identifier for the behavior or event
   * @returns {boolean} - true, if the corresponding event or behavior is currently subscribed
   */
  isSubscribed<T>(identifier: SignalId<T>): boolean {
    const isb = isBehaviorId(identifier);
    return isb
      ? this.behaviors.get(identifier)?.isObservableSubscribed() === true
      : this.eventStreams.get(identifier)?.isObservableSubscribed() === true;
  }

  /**
   * The getIsSubscribedObservable method is the reactive counterpart for the isSubscribed method,
   * also serving mainly for testing and debugging purposes (though in contrast to the non-reactive
   * counterpart, you could actually use this in some scenarios, but there are likely more idiomatic
   * ways).
   *
   * @param {SignalId<T>} identifier - the unique identifier for the behavior or event
   * @returns {Observable<boolean>} - upon subscription, lets you keep track whether the corresponding event or behavior is subscribed
   */
  getIsSubscribedObservable<T>(identifier: SignalId<T>): Observable<boolean> {
    const sym = identifier;
    return isBehaviorId(identifier)
      ? this.behaviorsSubject.asObservable().pipe(
          switchMap(s => s.get(sym)?.getIsSubscribedObservable() ?? of(false)),
          distinctUntilChanged(),
          share(),
        )
      : this.eventStreamsSubject.asObservable().pipe(
          switchMap(s => s.get(sym)?.getIsSubscribedObservable() ?? of(false)),
          distinctUntilChanged(),
          share(),
        );
  }

  /**
   * The getNumberOfBehaviorSources method returns the number of sources for the specified behavior.
   * Again, this is mostly for testing and debugging.
   *
   * @param {BehaviorId<T>} identifier - the unique identifier for the behavior
   * @returns {number} - the current number of sources for the specified behavior
   */
  getNumberOfBehaviorSources<T>(identifier: BehaviorId<T>): number {
    return this.getBehaviorControlledSubject(identifier).getNumberOfSources();
  }

  /**
   * The getNumberOfEventSources method returns the number of sources for the specified event.
   * Again, this is mostly for testing and debugging.
   *
   * @param {EventId<T>} identifier - the unique identifier for the event
   * @returns {number} - the current number of sources for the specified event
   */
  getNumberOfEventSources<T>(eventIdentifier: EventId<T>): number {
    return this.getEventStreamControlledSubject(eventIdentifier).getNumberOfSources();
  }

  /**
   * This method can be used to link a SignalId with a name.
   * The corresponding name will then be used in future debug methods to represent
   * tracked signals.
   *
   * @param {SignalId<T>} id - the id that should be linked to a name
   * @param {string} name - the name linked to the given id
   * @returns {void}
   */
  setIdName<T>(id: SignalId<T>, name: string): void {
    this.names.set(id, name);
  }

  /**
   * Get the name linked to the given SignalId.
   * If no specific name was linked (via setIdName), the default toString()
   * representation will be returned.
   *
   * @param {SignalId<T>} id - the id you are interested in
   * @returns {string} - the name linked to the id, or the corresponding toString() result
   */
  getIdName<T>(id: SignalId<T>): string {
    return this.getNameForSymbol(id);
  }

  private getNameForSymbol(id: symbol): string {
    return this.names.get(id) ?? id.toString();
  }

  private getDependentObservable<T>(
    observable: Observable<T>,
    subscribeObservableOnlyIfEventIsSubscribed: EventId<any> | null,
  ): Observable<T> {
    if (subscribeObservableOnlyIfEventIsSubscribed === null) {
      return observable;
    }
    return this.getEventStreamControlledSubject(subscribeObservableOnlyIfEventIsSubscribed)
      .getIsSubscribedObservable()
      .pipe(switchMap(isSubscribed => (isSubscribed ? observable : NEVER)));
  }

  private addTypedEventSource<T>(
    sourceIdentifier: symbol,
    eventIdentifier: EventId<T>,
    sharedSource: Observable<TypedEvent<T>>,
  ): void {
    const source = sharedSource.pipe(
      filter(typedEvent => typedEvent.type === eventIdentifier),
      map(event => event.event),
    );
    this.getEventStreamControlledSubject(eventIdentifier).addSource(
      new SourceObservable<T>(sourceIdentifier, source, true),
    );
  }

  private createBehaviorControlledSubject<T>(identifier: BehaviorId<T>): ControlledSubject<T> {
    const controlledSubject = new ControlledSubject<T>(
      identifier,
      true,
      (_, error) => {
        // If the source errors, error for the target.
        controlledSubject.error(error);
      },
      id => {
        // If a source completes, we remove it from the behavior.
        // We do not complete the target subject, because more sources might exist
        // or might be added at a later point of time.
        controlledSubject.removeSource(id);
      },
      this.delayedEventQueue,
    );
    this.behaviors.set(identifier, controlledSubject);
    this.behaviorsSubject.next(this.behaviors);
    return controlledSubject;
  }

  private getBehaviorControlledSubject<T>(identifier: BehaviorId<T>): ControlledSubject<T> {
    return this.behaviors.get(identifier) ?? this.createBehaviorControlledSubject(identifier);
  }

  private createEventStreamControlledSubject<T>(identifier: EventId<T>): ControlledSubject<T> {
    const controlledSubject = new ControlledSubject<T>(
      identifier,
      false,
      (_, error) => {
        // If a source errors, error for the target.
        controlledSubject.error(error);
      },
      id => {
        // If the source completes, we can remove it.
        // However, we cannot complete the target, even if it was the last source, because store.dispatch
        // is also a valid (never completing) source. Also, new sources might be added at a later point of time.
        controlledSubject.removeSource(id);
      },
      this.delayedEventQueue,
    );
    this.eventStreams.set(identifier, controlledSubject);
    this.eventStreamsSubject.next(this.eventStreams);
    return controlledSubject;
  }

  private getEventStreamControlledSubject<T>(identifier: EventId<T>): ControlledSubject<T> {
    return this.eventStreams.get(identifier) ?? this.createEventStreamControlledSubject(identifier);
  }

  private assertSourceExists(symbol: symbol, sourceIdentifier: symbol): void {
    if (
      (this.behaviors.has(symbol) && this.behaviors.get(symbol)?.hasSource(sourceIdentifier)) ||
      (this.eventStreams.has(symbol) && this.eventStreams.get(symbol)?.hasSource(sourceIdentifier))
    ) {
      throw new Error(
        `A behavior or event source with the given identifier has already been added: ${this.getNameForSymbol(
          symbol,
        )}`,
      );
    }
  }
}
