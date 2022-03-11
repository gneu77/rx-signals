import { asyncScheduler, BehaviorSubject, merge, NEVER, Observable, of } from 'rxjs';
import {
  delay,
  distinctUntilChanged,
  filter,
  map,
  mapTo,
  share,
  switchMap,
  take,
  withLatestFrom,
} from 'rxjs/operators';
import { ControlledSubject } from './controlled-subject';
import { DelayedEventQueue } from './delayed-event-queue';
import { SourceObservable } from './source-observable';
import { BehaviorId, EffectId, EventId, isBehaviorId, NO_VALUE, SignalId } from './store-utils';

/**
 * The rx-signals Store uses the TypedEvent<T> to bundle certain events and their
 * corresponding EventId<T>. This is used for EventSources that can dispatch events
 * of different types (see addXTypedEventSource methods) or for cases where you want to
 * subscribe multiple events and need to differentiate between them at runtime.
 *
 * @typedef {object} TypedEvent<T> - type for an object bundling identifier and corresponding event.
 * @template T - specifies the type for the corresponding EventId<T>
 * @property {EventId<T>} type - the EventId for the event
 * @property {T} event - the event itself
 */
export type TypedEvent<T> = Readonly<{
  type: EventId<T>;
  event: T;
}>;

/**
 * The state reducer type specifies the signature for reducers used by the store.
 * StateReducers must be pure functions.
 *
 * @typedef {function} StateReducer<T, E> - type for a pure function that takes a state and an event and returns a new state
 * @template T - representing the type of the state
 * @template E - representing the type of the event
 * @property {T} state - the current state
 * @property {E} event - the event
 * @returns {T} - the new state
 */
export type StateReducer<T, E> = (state: T, event: E) => T;

/**
 * The Effect type specifies a potentially impure function that takes an input and the store as arguments
 * and returns an effectful result as Observable.
 * It is the low-level abstraction used by rx-signals for side-effect isolation.
 * The high-level abstraction EffectSignalsFactory takes an EffectId as configuration to access
 * the corresponding Effect.
 * The store argument can be used to access additional input from the store (thus, the Effect itself could also
 * be pure and just use something impure that was put into the store, e.g. another Effect).
 * The previousInput argument can be used e.g. to decide whether the effect must perform
 * a computation/query/etc., or if maybe the previousResult can be returned directly.
 *
 * @typedef {function} Effect<InputType, ResultType> - function performing an effect and returning an observable with the result
 * @template InputType - specifies the input type for the effect
 * @template ResultType - specifies the result type for the effect
 * @property {InputType} input - the effect input
 * @property {Store} store - the Store instance that will be passed to the function (e.g. to inject some other Effect).
 * @property {InputType | undefined} previousInput - the input of the previous function invocation, or undefined
 * @property {ResultType | undefined} previousResult - the result of the previous function invocation, or undefined
 */
export type Effect<InputType, ResultType> = (
  input: InputType,
  store: Store,
  previousInput?: InputType,
  previousResult?: ResultType,
) => Observable<ResultType>;

/**
 * The rx-signals Store provides RxJs-Observables for RP (reactive programming) BehaviorStreams
 * and EventStreams (behaviors and events are the two different types of signals, where behaviors represent state).
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

  /**
   * This method adds the given observable as source for the behavior identified by the
   * given identifier. If the observable represents root-state (state that depends on events only, but not on any
   * other behaviors), subscribeLazy should be false, except for cases where you're really sure that it is OK to
   * miss events while you do not actively subscribe the behavior.
   * If the observable only depends on other behaviors, but not on any events, subscribeLazy should be true of course (there
   * is no need to run the observable until it becomes actively subscribed).
   * Also, if it depends on any other lazy behavior (derived state), subscribeLazy should be true (because otherwise the lazy
   * behavior it depends on would become non-lazy).
   * Analogously, if it depends on an event-source that should be lazy subscribed, subscribeLazy should be true.
   * If your behavior needs to be non-lazy, but at the same time an event-source you depend on should be lazy,
   * this situation can be solved using one of the addXTypedEventSource methods (see corresponding documentation).
   *
   * @param {BehaviorId<T>} identifier - the unique identifier for the behavior
   * @param {Observable<T>} observable - the source for the behavior
   * @param {boolean} subscribeLazy - set this to false, if the behavior should always be subscribed (the Store will subscribe it in that case, immediately turning it into a hot observable)
   * @param {T | (() => T) | symbol} initialValueOrValueGetter - the initial value or value getter (for lazy initialization) or symbol NO_VALUE, if there is no initial value (default)
   * @returns {void}
   */
  addBehavior<T>(
    identifier: BehaviorId<T>,
    observable: Observable<T>,
    subscribeLazy: boolean,
    initialValueOrValueGetter: T | (() => T) | symbol = NO_VALUE,
  ): void {
    this.assertSourceExists(identifier, identifier);
    this.getBehaviorControlledSubject(identifier).addSource(
      new SourceObservable<T>(identifier, observable, subscribeLazy, initialValueOrValueGetter),
    );
    if (this.parentStore) {
      // to trigger behavior-switch in child-stores (see getBehavior):
      this.behaviorsSubject.next(this.behaviors);
    }
  }

  /**
   * This adds an observable representing derived state, hence only depending on other
   * behaviors, to the store.
   * It is equivalent to calling addBehavior with parameter subscribeLazy = true.
   * (See addBehavior documentation for more detailed information on lazy vs. non-lazy behaviors.)
   *
   * @param {BehaviorId<T>} identifier - the unique identifier for the behavior
   * @param {Observable<T>} observable - the source for the behavior
   * @param {T | (() => T) | symbol} initialValueOrValueGetter - the initial value or value getter (for lazy initialization) or symbol NO_VALUE, if there is no initial value (default)
   * @returns {void}
   */
  addDerivedState<T>(
    identifier: BehaviorId<T>,
    observable: Observable<T>,
    initialValueOrValueGetter: T | (() => T) | symbol = NO_VALUE,
  ): void {
    this.addBehavior(identifier, observable, true, initialValueOrValueGetter);
  }

  /**
   * This method adds a source for the non-lazy behavior specified by the given identifier, that provides the
   * given value as initial value for the behavior. It will be the only value, as long as no reducer is added.
   * Calling addState(id, value) has the same result as calling addBehavior(id, NEVER, false, value) , however,
   * the latter would not be idiomatic.
   * You can however use addBehavior instead of addState plus reducers, e.g. if there's only a single event
   * myEvent, you could use something like addBehavior(id, store.getEventStream(myEvent), false, initialValue).
   * (See addBehavior documentation on how to decide between lazy and non-lazy)
   *
   * @param {BehaviorId<T>} identifier - the unique identifier for the behavior
   * @param {T | (() => T)} initialValueOrValueGetter - the initial value or value getter (for lazy initialization)
   * @returns {void}
   */
  addState<T>(identifier: BehaviorId<T>, initialValueOrValueGetter: T | (() => T)): void {
    this.assertSourceExists(identifier, identifier);
    this.getBehaviorControlledSubject(identifier).addSource(
      new SourceObservable<T>(identifier, NEVER, false, initialValueOrValueGetter),
    );
  }

  /**
   * This adds a reducer to a behavior. This is meant to be used together with the addState method.
   * Technically, you can also add reducers to behaviors that were added with the addBevavior method.
   * However, this is strongly discouraged and might result in unexpected behavior (literally)!
   *
   * @param {BehaviorId<T>} stateIdentifier - the unique identifier for the behavior
   * @param {EventId<T>} eventIdentifier - the unique identifier for the event reducing the state
   * @param {StateReducer<T, E>} reducer - pure function that takes the previous state and the event and returns a new state
   * @returns {void}
   */
  addReducer<T, E>(
    stateIdentifier: BehaviorId<T>,
    eventIdentifier: EventId<E>,
    reducer: StateReducer<T, E>,
  ): void {
    const sourceObservable = this.getEventStream(eventIdentifier).pipe(
      withLatestFrom(this.getBehavior(stateIdentifier)),
      map(([event, state]) => reducer(state, event)),
    );
    this.getBehaviorControlledSubject(stateIdentifier).addSource(
      new SourceObservable<T>(eventIdentifier, sourceObservable, false),
    );
  }

  /**
   * This method can be used to remove a reducer from a behavior.
   *
   * @param {TypeIdentifier<T>} stateIdentifier - the unique identifier for the behavior
   * @param {TypeIdentifier<T>} eventIdentifier - the unique identifier for the event the reducer is handling
   * @returns {void}
   */
  removeReducer<T, E>(stateIdentifier: BehaviorId<T>, eventIdentifier: EventId<E>): void {
    this.getBehaviorControlledSubject(stateIdentifier).removeSource(eventIdentifier);
  }

  /**
   * The connect method takes a source- and a target-ID and add a corresponding source for the targetId
   * to the store, connecting the source event or behavior with the target event or behavior.
   *
   * If the targetId is a BehaviorId, the optional lazy-parameter is considered:
   * In case the sourceId is an EventId, it defaults to false, else to true.
   *
   * If the targetId is an EventId, a corresponding EventSource will be added to the store and the optional
   * lazy-parameter has no meaning.
   *
   * Hence, if targetId is a BehaviorId, it must not yet exist in the store, else this method will throw a corresponding error!
   *
   * @param {SignalId<T>} sourceId - the unique identifier for the source event or behavior
   * @param {SignalId<T>} targetId - the unique identifier for the target event or behavior
   * @param {boolean | undefined} lazy - optional parameter that defaults to false, if the source is an event, else to true. If the target is a behavior, lazy defines whether its lazy or not, else the parameter is meaningless.
   * @returns {void | symbol} - symbol of the added event source in case the targetId is an EventId, else void
   */
  connect<T, S extends SignalId<T>>(
    sourceId: SignalId<T>,
    targetId: S,
    lazy?: boolean,
  ): S extends BehaviorId<T> ? void : symbol {
    const source = isBehaviorId(sourceId)
      ? this.getBehavior(sourceId as BehaviorId<T>)
      : this.getEventStream(sourceId as EventId<T>);
    const lazyParam = (lazy ?? null) === null ? isBehaviorId(sourceId) : (lazy as boolean);
    return this.connectObservable(source, targetId, lazyParam);
  }

  /**
   * This connects the source observable with the target event or behavior.
   * If the targetId is a BehaviorId, a corresponding behavior source will be added
   * to the store, considering the lazy-parameter (see addBehavior).
   * If the targetId is an EventId, a corresponding EventSource will be added to the store and the
   * lazy-parameter has no meaning.
   * Hence, if targetId is a BehaviorId, it must not yet exist in the store, else this method will throw a corresponding error!
   *
   * @param {Observable<T>} source - the source observable
   * @param {SignalId<T>} targetId - the unique identifier for the target event or behavior
   * @param {boolean} lazy - If the target is a behavior, lazy defines whether its lazy or not, else the parameter is meaningless.
   * @returns {void | symbol} - symbol of the added event source in case the targetId is an EventId, else void
   */
  connectObservable<T, S extends SignalId<T>>(
    source: Observable<T>,
    targetId: S,
    lazy: boolean,
  ): S extends BehaviorId<T> ? void : symbol {
    if (isBehaviorId(targetId)) {
      return this.addBehavior(
        targetId as BehaviorId<T>,
        source,
        lazy,
        NO_VALUE,
      ) as S extends BehaviorId<T> ? void : symbol;
    } else {
      return this.addEventSource(targetId as EventId<T>, source) as S extends BehaviorId<T>
        ? void
        : symbol;
    }
  }

  /**
   * This method removes all sources for a behavior.
   * (Yes, from the API-point-of-view, there can be only one source for a behavior. However, technically
   *  each reducer added for a behavior also represents a source.)
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
   *
   * @returns {void} - the behavior observable (shared and distinct)
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
   * @param {T} event - the event of the type specified by the identifier
   * @returns {Promise<boolean>} - a promise that resolves to true, if the event was subscribed, else to false
   */
  dispatch<T>(identifier: EventId<T>, event: T): Promise<boolean> {
    const controlledSubject = this.getEventStreamControlledSubject(identifier);
    if (controlledSubject.isObservableSubscribed()) {
      const result: Promise<boolean> = this.getEventStream(identifier)
        .pipe(
          filter(val => val === event),
          take(1),
          mapTo(true),
          delay(1, asyncScheduler),
        )
        .toPromise() as Promise<boolean>;
      controlledSubject.next(event);
      return result;
    }
    return Promise.resolve(false);
  }

  /**
   * This method adds an event source to the Store. There can be multiple sources
   * for the same event type. However, each source must be identified by its own
   * symbol and adding two sources with the same symbol would result in an error.
   * Event sources are effects!
   *
   * @param {EventId<T>} eventIdentifier - the unique identifier for the event
   * @param {Observable<T>} observable - the event source
   * @returns {smybol} - a symbol that can be used to remove the event-source from the store
   */
  addEventSource<T>(eventIdentifier: EventId<T>, observable: Observable<T>): symbol {
    const sourceId = Symbol('');
    this.getEventStreamControlledSubject(eventIdentifier).addSource(
      new SourceObservable<T>(sourceId, observable, true),
    );
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
  add2TypedEventSource<A, B>(
    eventIdentifierA: EventId<A>,
    eventIdentifierB: EventId<B>,
    observable: Observable<TypedEvent<A> | TypedEvent<B>>,
    subscribeObservableOnlyIfEventIsSubscribed: EventId<any> | null = null,
  ): symbol {
    const sourceId = Symbol('');
    const sharedSource = this.getDependentObservable(
      observable.pipe(delay(1, asyncScheduler), share()),
      subscribeObservableOnlyIfEventIsSubscribed,
    );
    this.addTypedEventSource(sourceId, eventIdentifierA, sharedSource as Observable<TypedEvent<A>>);
    this.addTypedEventSource(sourceId, eventIdentifierB, sharedSource as Observable<TypedEvent<B>>);
    return sourceId;
  }

  /**
   * See add2TypedEventSource
   *
   * @param {TypeIdentifier<A>} eventIdentifierA - the unique identifier for event type A
   * @param {TypeIdentifier<B>} eventIdentifierB - the unique identifier for event type B
   * @param {TypeIdentifier<C>} eventIdentifierC - the unique identifier for event type C
   * @param {Observable<TypedEvent<A> | TypedEvent<B> | TypedEvent<C>>} observable - the event source
   * @param {TypeIdentifier<any> | null} subscribeObservableOnlyIfEventIsSubscribed - defaults to null
   * @returns {smybol} - a symbol that can be used to remove the event-source from the store
   */
  add3TypedEventSource<A, B, C>(
    eventIdentifierA: EventId<A>,
    eventIdentifierB: EventId<B>,
    eventIdentifierC: EventId<C>,
    observable: Observable<TypedEvent<A> | TypedEvent<B> | TypedEvent<C>>,
    subscribeObservableOnlyIfEventIsSubscribed: EventId<any> | null = null,
  ): symbol {
    const sourceId = Symbol('');
    const sharedSource = this.getDependentObservable(
      observable.pipe(delay(1, asyncScheduler), share()),
      subscribeObservableOnlyIfEventIsSubscribed,
    );
    this.addTypedEventSource(sourceId, eventIdentifierA, sharedSource as Observable<TypedEvent<A>>);
    this.addTypedEventSource(sourceId, eventIdentifierB, sharedSource as Observable<TypedEvent<B>>);
    this.addTypedEventSource(sourceId, eventIdentifierC, sharedSource as Observable<TypedEvent<C>>);
    return sourceId;
  }

  /**
   * See add2TypedEventSource
   *
   * @param {TypeIdentifier<A>} eventIdentifierA - the unique identifier for event type A
   * @param {TypeIdentifier<B>} eventIdentifierB - the unique identifier for event type B
   * @param {TypeIdentifier<C>} eventIdentifierC - the unique identifier for event type C
   * @param {TypeIdentifier<D>} eventIdentifierD - the unique identifier for event type D
   * @param {Observable<TypedEvent<A> | TypedEvent<B> | TypedEvent<C> | TypedEvent<D>>} observable - the event source
   * @param {TypeIdentifier<any> | null} subscribeObservableOnlyIfEventIsSubscribed - defaults to null
   * @returns {smybol} - a symbol that can be used to remove the event-source from the store
   */
  add4TypedEventSource<A, B, C, D>(
    eventIdentifierA: EventId<A>,
    eventIdentifierB: EventId<B>,
    eventIdentifierC: EventId<C>,
    eventIdentifierD: EventId<D>,
    observable: Observable<TypedEvent<A> | TypedEvent<B> | TypedEvent<C> | TypedEvent<D>>,
    subscribeObservableOnlyIfEventIsSubscribed: EventId<any> | null = null,
  ): symbol {
    const sourceId = Symbol('');
    const sharedSource = this.getDependentObservable(
      observable.pipe(delay(1, asyncScheduler), share()),
      subscribeObservableOnlyIfEventIsSubscribed,
    );
    this.addTypedEventSource(sourceId, eventIdentifierA, sharedSource as Observable<TypedEvent<A>>);
    this.addTypedEventSource(sourceId, eventIdentifierB, sharedSource as Observable<TypedEvent<B>>);
    this.addTypedEventSource(sourceId, eventIdentifierC, sharedSource as Observable<TypedEvent<C>>);
    this.addTypedEventSource(sourceId, eventIdentifierD, sharedSource as Observable<TypedEvent<D>>);
    return sourceId;
  }

  /**
   * See add2TypedEventSource
   *
   * @param {TypeIdentifier<A>} eventIdentifierA - the unique identifier for event type A
   * @param {TypeIdentifier<B>} eventIdentifierB - the unique identifier for event type B
   * @param {TypeIdentifier<C>} eventIdentifierC - the unique identifier for event type C
   * @param {TypeIdentifier<D>} eventIdentifierD - the unique identifier for event type D
   * @param {TypeIdentifier<E>} eventIdentifierE - the unique identifier for event type E
   * @param {Observable<TypedEvent<A> | TypedEvent<B> | TypedEvent<C> | TypedEvent<D> | TypedEvent<E>>} observable - the event source
   * @param {TypeIdentifier<any> | null} subscribeObservableOnlyIfEventIsSubscribed - defaults to null
   * @returns {smybol} - a symbol that can be used to remove the event-source from the store
   */
  add5TypedEventSource<A, B, C, D, E>(
    eventIdentifierA: EventId<A>,
    eventIdentifierB: EventId<B>,
    eventIdentifierC: EventId<C>,
    eventIdentifierD: EventId<D>,
    eventIdentifierE: EventId<E>,
    observable: Observable<
      TypedEvent<A> | TypedEvent<B> | TypedEvent<C> | TypedEvent<D> | TypedEvent<E>
    >,
    subscribeObservableOnlyIfEventIsSubscribed: EventId<any> | null = null,
  ): symbol {
    const sourceId = Symbol('');
    const sharedSource = this.getDependentObservable(
      observable.pipe(delay(1, asyncScheduler), share()),
      subscribeObservableOnlyIfEventIsSubscribed,
    );
    this.addTypedEventSource(sourceId, eventIdentifierA, sharedSource as Observable<TypedEvent<A>>);
    this.addTypedEventSource(sourceId, eventIdentifierB, sharedSource as Observable<TypedEvent<B>>);
    this.addTypedEventSource(sourceId, eventIdentifierC, sharedSource as Observable<TypedEvent<C>>);
    this.addTypedEventSource(sourceId, eventIdentifierD, sharedSource as Observable<TypedEvent<D>>);
    this.addTypedEventSource(sourceId, eventIdentifierE, sharedSource as Observable<TypedEvent<E>>);
    return sourceId;
  }

  /**
   * See add2TypedEventSource
   *
   * @param {TypeIdentifier<A>} eventIdentifierA - the unique identifier for event type A
   * @param {TypeIdentifier<B>} eventIdentifierB - the unique identifier for event type B
   * @param {TypeIdentifier<C>} eventIdentifierC - the unique identifier for event type C
   * @param {TypeIdentifier<D>} eventIdentifierD - the unique identifier for event type D
   * @param {TypeIdentifier<E>} eventIdentifierE - the unique identifier for event type E
   * @param {TypeIdentifier<F>} eventIdentifierF - the unique identifier for event type F
   * @param {Observable<TypedEvent<A> | TypedEvent<B> | TypedEvent<C> | TypedEvent<D> | TypedEvent<E> | TypedEvent<F>>} observable - the event source
   * @param {TypeIdentifier<any> | null} subscribeObservableOnlyIfEventIsSubscribed - defaults to null
   * @returns {smybol} - a symbol that can be used to remove the event-source from the store
   */
  add6TypedEventSource<A, B, C, D, E, F>(
    eventIdentifierA: EventId<A>,
    eventIdentifierB: EventId<B>,
    eventIdentifierC: EventId<C>,
    eventIdentifierD: EventId<D>,
    eventIdentifierE: EventId<E>,
    eventIdentifierF: EventId<F>,
    observable: Observable<
      TypedEvent<A> | TypedEvent<B> | TypedEvent<C> | TypedEvent<D> | TypedEvent<E> | TypedEvent<F>
    >,
    subscribeObservableOnlyIfEventIsSubscribed: EventId<any> | null = null,
  ): symbol {
    const sourceId = Symbol('');
    const sharedSource = this.getDependentObservable(
      observable.pipe(delay(1, asyncScheduler), share()),
      subscribeObservableOnlyIfEventIsSubscribed,
    );
    this.addTypedEventSource(sourceId, eventIdentifierA, sharedSource as Observable<TypedEvent<A>>);
    this.addTypedEventSource(sourceId, eventIdentifierB, sharedSource as Observable<TypedEvent<B>>);
    this.addTypedEventSource(sourceId, eventIdentifierC, sharedSource as Observable<TypedEvent<C>>);
    this.addTypedEventSource(sourceId, eventIdentifierD, sharedSource as Observable<TypedEvent<D>>);
    this.addTypedEventSource(sourceId, eventIdentifierE, sharedSource as Observable<TypedEvent<E>>);
    this.addTypedEventSource(sourceId, eventIdentifierF, sharedSource as Observable<TypedEvent<F>>);
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
   * be a strong indicator of flawed design, because it could break MVU/reactivity).
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
   * @param {EffectId<InputType, ResultType>} id - the unique identifier for the effect
   * @param {Effect<InputType, ResultType>} effect - the Effect function
   * @returns {void}
   */
  addEffect<InputType, ResultType>(
    id: EffectId<InputType, ResultType>,
    effect: Effect<InputType, ResultType>,
  ): void {
    this.addState<Effect<InputType, ResultType>>(
      id as unknown as BehaviorId<Effect<InputType, ResultType>>,
      () => effect,
    );
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
