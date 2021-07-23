import { asyncScheduler, BehaviorSubject, combineLatest, merge, NEVER, Observable, of } from 'rxjs';
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
import { NO_VALUE, TypeIdentifier } from './store.utils';

/**
 * The RX-SIGNALS Store uses the TypedEvent<T> interface to bundle certain event and their
 * corresponding TypeIdentifier<T>. This is used for EventSources that can dispatch events
 * of different types (see addXTypedEventSource mehtods) or for cases where you want to
 * subscribe multiple event and need to differentiate between them at runtime.
 *
 * @typedef {object} TypedEvent<T> - interface for an object used to identify a certain behavior or event
 * @template T - specifies the type for the corresponding TypeIdentifier<T>
 * @property {TypeIdentifier<T>} type - the TypeIdentifier for the event
 * @property {T} event - the event itself
 */
export interface TypedEvent<T> {
  readonly type: TypeIdentifier<T>;
  readonly event: T;
}

/**
 * The RX-SIGNALS Store uses the TypedEvent<T> interface to bundle certain event and their
 * corresponding TypeIdentifier<T>. This is used for EventSources that can dispatch events
 * of different types (see addXTypedEventSource mehtods) or for cases where you want to
 * subscribe multiple event and need to differentiate between them at runtime.
 *
 * @typedef {function} StateReducer<T, E> - type for a function that takes a state and an event and returns a new state
 * @template T - representing the type of the state
 * @template E - representing the type of the event
 * @property {T} state - the current state
 * @property {E} event - the event
 * @returns {T} - the new state
 */
export type StateReducer<T, E> = (state: T, event: E) => T;

/**
 * The RX-SIGNALS Store provides RxJs-Observables for RP (reactive programming) BehaviorStreams
 * and EventStreams (in original FRP, behaviors and events are the two different types of signals).
 * What the Store really does for you is separating the sources of these streams from the streams itself.
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
   * Return itself, if this store has no parent.
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
   * given identifier.
   *
   * @param {TypeIdentifier<T>} identifier - the unique identifier for the behavior
   * @param {Observable<T>} observable - the source for the behavior
   * @param {boolean} subscribeLazy - set this to false, if the behavior should always be subscribed (the Store will subscribe it in that case)
   * @param {T | (() => T) | symbol} initialValueOrValueGetter - the initial value or value getter (for lazy initialization) or symbol NO_VALUE, if there is no initial value (default)
   * @returns {void}
   */
  addBehavior<T>(
    identifier: TypeIdentifier<T>,
    observable: Observable<T>,
    subscribeLazy: boolean,
    initialValueOrValueGetter: T | (() => T) | symbol = NO_VALUE,
  ): void {
    this.assertSourceExists(identifier.symbol, identifier.symbol);
    this.getBehaviorControlledSubject(identifier).addSource(
      new SourceObservable<T>(
        identifier.symbol,
        observable,
        subscribeLazy,
        initialValueOrValueGetter,
      ),
    );
  }

  /**
   * The same as calling addBehavior with parameter subscribeLazy = true
   *
   * @param {TypeIdentifier<T>} identifier - the unique identifier for the behavior
   * @param {Observable<T>} observable - the source for the behavior
   * @param {T | (() => T) | symbol} initialValueOrValueGetter - the initial value or value getter (for lazy initialization) or symbol NO_VALUE, if there is no initial value (default)
   * @returns {void}
   */
  addLazyBehavior<T>(
    identifier: TypeIdentifier<T>,
    observable: Observable<T>,
    initialValueOrValueGetter: T | (() => T) | symbol = NO_VALUE,
  ): void {
    this.addBehavior(identifier, observable, true, initialValueOrValueGetter);
  }

  /**
   * The same as calling addBehavior with parameter subscribeLazy = false
   *
   * @param {TypeIdentifier<T>} identifier - the unique identifier for the behavior
   * @param {Observable<T>} observable - the source for the behavior
   * @param {T | (() => T) | symbol} initialValueOrValueGetter - the initial value or value getter (for lazy initialization) or symbol NO_VALUE, if there is no initial value (default)
   * @returns {void}
   */
  addNonLazyBehavior<T>(
    identifier: TypeIdentifier<T>,
    observable: Observable<T>,
    initialValueOrValueGetter: T | (() => T) | symbol = NO_VALUE,
  ): void {
    this.addBehavior(identifier, observable, false, initialValueOrValueGetter);
  }

  /**
   * This method adds a source for the non-lazy behavior specified by the given identifier, that provides the
   * given value as initial value for the behavior. It will be the only value, as long as no reducer is added.
   *
   * @param {TypeIdentifier<T>} identifier - the unique identifier for the behavior
   * @param {T | (() => T)} initialValueOrValueGetter - the initial value or value getter (for lazy initialization)
   * @returns {void}
   */
  addState<T>(identifier: TypeIdentifier<T>, initialValueOrValueGetter: T | (() => T)): void {
    this.assertSourceExists(identifier.symbol, identifier.symbol);
    this.getBehaviorControlledSubject(identifier).addSource(
      new SourceObservable<T>(identifier.symbol, NEVER, false, initialValueOrValueGetter),
    );
  }

  /**
   * This adds a reducer to a bahavior. This is meant to be used together with the addState method.
   * Technically, you can also add reducers to behaviors that were added with one of the addBevavior methods.
   * However, this is strongly discouraged and might result in unexpected (literally) behavior.
   *
   * @param {TypeIdentifier<T>} stateIdentifier - the unique identifier for the behavior
   * @param {TypeIdentifier<T>} eventIdentifier - the unique identifier for the event reducing the state
   * @param {StateReducer<T, E>} reducer - pure function that takes the previous state and the event and returns a new state
   * @returns {void}
   */
  addReducer<T, E>(
    stateIdentifier: TypeIdentifier<T>,
    eventIdentifier: TypeIdentifier<E>,
    reducer: StateReducer<T, E>,
  ): void {
    const sourceObservable = this.getEventStream(eventIdentifier).pipe(
      withLatestFrom(this.getBehavior(stateIdentifier)),
      map(([event, state]) => reducer(state, event)),
    );
    this.getBehaviorControlledSubject(stateIdentifier).addSource(
      new SourceObservable<T>(eventIdentifier.symbol, sourceObservable, false),
    );
  }

  /**
   * This method can be used to remove a reducer from a behavior.
   *
   * @param {TypeIdentifier<T>} stateIdentifier - the unique identifier for the behavior
   * @param {TypeIdentifier<T>} eventIdentifier - the unique identifier for the event the reducer is handling
   * @returns {void}
   */
  removeReducer<T, E>(
    stateIdentifier: TypeIdentifier<T>,
    eventIdentifier: TypeIdentifier<E>,
  ): void {
    this.getBehaviorControlledSubject(stateIdentifier).removeSource(eventIdentifier.symbol);
  }

  /**
   * This method removes all sources for a behavior.
   * (Yes, from the API-point-of-view, there can be only one source for a behavior. However, technically
   *  each reducer added for a behavior also represents a source.)
   *
   * @param {TypeIdentifier<T>} identifier - the unique identifier for the behavior
   * @returns {void}
   */
  removeBehaviorSources<T>(identifier: TypeIdentifier<T>): void {
    const behavior = this.getBehaviorControlledSubject(identifier);
    behavior.removeAllSources();
  }

  /**
   * This method removes all sources for a behavior and then completes the behavior for all
   * current subscribers.
   *
   * @param {TypeIdentifier<T>} identifier - the unique identifier for the behavior
   * @returns {void}
   */
  completeBehavior<T>(identifier: TypeIdentifier<T>): void {
    const behavior = this.getBehaviorControlledSubject(identifier);
    behavior.removeAllSources();
    behavior.complete();
    this.behaviors.delete(identifier.symbol);
    this.behaviorsSubject.next(this.behaviors);
  }

  /**
   * This method returns the behavior specified by identifier. It does not matter, if a source
   * for the behavior has already been added or not. If a source has already been added, a
   * subscriber will get the latest value from the source. Else, a subscriber will get the
   * initial value, as soon as a source is added.
   * Please note, that all behaviors are shared and distinct value streams (hence you do not
   * have to pipe with distinctUntilChanged and shareReplay yourself). The sharing behaves like
   * shareReplay(1), but without the risk of a memory leak that would be possible with shareReplay(1).
   * If this store has a parent store, then as long as no behavior source is added for the child, the
   * behavior will be received from the parent. As soon, as a corresponding source is added to the child,
   * you will receive the behavior values from the child.
   *
   * @param {TypeIdentifier<T>} identifier - the unique identifier for the behavior
   * @returns {Observable<T>} - the behavior observable (shared and distinct)
   */
  getBehavior<T>(identifier: TypeIdentifier<T>): Observable<T> {
    if (this.parentStore) {
      const parent: Store = this.parentStore;
      return this.behaviorsSubject
        .asObservable()
        .pipe(
          switchMap(s =>
            (s.get(identifier.symbol)?.getNumberOfSources() ?? 0) > 0
              ? this.getBehaviorControlledSubject(identifier).getObservable()
              : parent.getBehavior(identifier),
          ),
        );
    }
    return this.getBehaviorControlledSubject(identifier).getObservable();
  }

  /**
   * This method resets all behaviors, effectively resetting the complete store to the state it
   * had before any event was dispatched (technically, this is done by first removing all sources
   * and then adding them again).
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
   * either in form of another event, or in form of a corresponding new state).
   *
   * @param {TypeIdentifier<T>} identifier - the unique identifier for the event
   * @param {T} event - the event of the type specified by the identifier
   * @returns {Promise<boolean>} - a promise that resolves to true, if the event was subscribed, else to false
   */
  dispatchEvent<T>(identifier: TypeIdentifier<T>, event: T): Promise<boolean> {
    const controlledSubject = this.getEventStreamControlledSubject(identifier);
    if (controlledSubject.isObservableSubscribed()) {
      const result: Promise<boolean> = this.getEventStream(identifier)
        .pipe(
          filter(val => val === event),
          take(1),
          mapTo(true),
          delay(1, asyncScheduler),
        )
        .toPromise();
      controlledSubject.next(event);
      return result;
    }
    return Promise.resolve(false);
  }

  /**
   * This method adds an event source to the Store. There can be multiple sources
   * for the same event type. However, each source must be identified by its own
   * symbol and adding two sources with the same symbol would result in an error.
   * Event sources are effects.
   *
   * @param {symbol} sourceIdentifier - each source must be uniquely identified by a symbol
   * @param {TypeIdentifier<T>} eventIdentifier - the unique identifier for the event
   * @param {Observable<T>} observable - the event source
   * @returns {void}
   */
  addEventSource<T>(
    sourceIdentifier: symbol,
    eventIdentifier: TypeIdentifier<T>,
    observable: Observable<T>,
  ): void {
    this.assertSourceExists(sourceIdentifier, sourceIdentifier);
    this.getEventStreamControlledSubject(eventIdentifier).addSource(
      new SourceObservable<T>(sourceIdentifier, observable, true),
    );
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
   * @param {symbol} sourceIdentifier - each source must be uniquely identified by a symbol
   * @param {TypeIdentifier<A>} eventIdentifierA - the unique identifier for event type A
   * @param {TypeIdentifier<B>} eventIdentifierB - the unique identifier for event type B
   * @param {Observable<TypedEvent<A> | TypedEvent<B>>} observable - the event source
   * @param {TypeIdentifier<any> | null} subscribeObservableOnlyIfEventIsSubscribed - defaults to null
   * @returns {void}
   */
  add2TypedEventSource<A, B>(
    sourceIdentifier: symbol,
    eventIdentifierA: TypeIdentifier<A>,
    eventIdentifierB: TypeIdentifier<B>,
    observable: Observable<TypedEvent<A> | TypedEvent<B>>,
    subscribeObservableOnlyIfEventIsSubscribed: TypeIdentifier<any> | null = null,
  ): void {
    this.assertSourceExists(sourceIdentifier, sourceIdentifier);
    const sharedSource = this.getDependentObservable(
      observable.pipe(delay(1, asyncScheduler), share()),
      subscribeObservableOnlyIfEventIsSubscribed,
    );
    this.addTypedEventSource(
      sourceIdentifier,
      eventIdentifierA,
      sharedSource as Observable<TypedEvent<A>>,
    );
    this.addTypedEventSource(
      sourceIdentifier,
      eventIdentifierB,
      sharedSource as Observable<TypedEvent<B>>,
    );
  }

  /**
   * See add2TypedEventSource
   *
   * @param {symbol} sourceIdentifier - each source must be uniquely identified by a symbol
   * @param {TypeIdentifier<A>} eventIdentifierA - the unique identifier for event type A
   * @param {TypeIdentifier<B>} eventIdentifierB - the unique identifier for event type B
   * @param {TypeIdentifier<C>} eventIdentifierC - the unique identifier for event type C
   * @param {Observable<TypedEvent<A> | TypedEvent<B> | TypedEvent<C>>} observable - the event source
   * @param {TypeIdentifier<any> | null} subscribeObservableOnlyIfEventIsSubscribed - defaults to null
   * @returns {void}
   */
  add3TypedEventSource<A, B, C>(
    sourceIdentifier: symbol,
    eventIdentifierA: TypeIdentifier<A>,
    eventIdentifierB: TypeIdentifier<B>,
    eventIdentifierC: TypeIdentifier<C>,
    observable: Observable<TypedEvent<A> | TypedEvent<B> | TypedEvent<C>>,
    subscribeObservableOnlyIfEventIsSubscribed: TypeIdentifier<any> | null = null,
  ): void {
    this.assertSourceExists(sourceIdentifier, sourceIdentifier);
    const sharedSource = this.getDependentObservable(
      observable.pipe(delay(1, asyncScheduler), share()),
      subscribeObservableOnlyIfEventIsSubscribed,
    );
    this.addTypedEventSource(
      sourceIdentifier,
      eventIdentifierA,
      sharedSource as Observable<TypedEvent<A>>,
    );
    this.addTypedEventSource(
      sourceIdentifier,
      eventIdentifierB,
      sharedSource as Observable<TypedEvent<B>>,
    );
    this.addTypedEventSource(
      sourceIdentifier,
      eventIdentifierC,
      sharedSource as Observable<TypedEvent<C>>,
    );
  }

  /**
   * See add2TypedEventSource
   *
   * @param {symbol} sourceIdentifier - each source must be uniquely identified by a symbol
   * @param {TypeIdentifier<A>} eventIdentifierA - the unique identifier for event type A
   * @param {TypeIdentifier<B>} eventIdentifierB - the unique identifier for event type B
   * @param {TypeIdentifier<C>} eventIdentifierC - the unique identifier for event type C
   * @param {TypeIdentifier<D>} eventIdentifierD - the unique identifier for event type D
   * @param {Observable<TypedEvent<A> | TypedEvent<B> | TypedEvent<C> | TypedEvent<D>>} observable - the event source
   * @param {TypeIdentifier<any> | null} subscribeObservableOnlyIfEventIsSubscribed - defaults to null
   * @returns {void}
   */
  add4TypedEventSource<A, B, C, D>(
    sourceIdentifier: symbol,
    eventIdentifierA: TypeIdentifier<A>,
    eventIdentifierB: TypeIdentifier<B>,
    eventIdentifierC: TypeIdentifier<C>,
    eventIdentifierD: TypeIdentifier<D>,
    observable: Observable<TypedEvent<A> | TypedEvent<B> | TypedEvent<C> | TypedEvent<D>>,
    subscribeObservableOnlyIfEventIsSubscribed: TypeIdentifier<any> | null = null,
  ): void {
    this.assertSourceExists(sourceIdentifier, sourceIdentifier);
    const sharedSource = this.getDependentObservable(
      observable.pipe(delay(1, asyncScheduler), share()),
      subscribeObservableOnlyIfEventIsSubscribed,
    );
    this.addTypedEventSource(
      sourceIdentifier,
      eventIdentifierA,
      sharedSource as Observable<TypedEvent<A>>,
    );
    this.addTypedEventSource(
      sourceIdentifier,
      eventIdentifierB,
      sharedSource as Observable<TypedEvent<B>>,
    );
    this.addTypedEventSource(
      sourceIdentifier,
      eventIdentifierC,
      sharedSource as Observable<TypedEvent<C>>,
    );
    this.addTypedEventSource(
      sourceIdentifier,
      eventIdentifierD,
      sharedSource as Observable<TypedEvent<D>>,
    );
  }

  /**
   * See add2TypedEventSource
   *
   * @param {symbol} sourceIdentifier - each source must be uniquely identified by a symbol
   * @param {TypeIdentifier<A>} eventIdentifierA - the unique identifier for event type A
   * @param {TypeIdentifier<B>} eventIdentifierB - the unique identifier for event type B
   * @param {TypeIdentifier<C>} eventIdentifierC - the unique identifier for event type C
   * @param {TypeIdentifier<D>} eventIdentifierD - the unique identifier for event type D
   * @param {TypeIdentifier<E>} eventIdentifierE - the unique identifier for event type E
   * @param {Observable<TypedEvent<A> | TypedEvent<B> | TypedEvent<C> | TypedEvent<D> | TypedEvent<E>>} observable - the event source
   * @param {TypeIdentifier<any> | null} subscribeObservableOnlyIfEventIsSubscribed - defaults to null
   * @returns {void}
   */
  add5TypedEventSource<A, B, C, D, E>(
    sourceIdentifier: symbol,
    eventIdentifierA: TypeIdentifier<A>,
    eventIdentifierB: TypeIdentifier<B>,
    eventIdentifierC: TypeIdentifier<C>,
    eventIdentifierD: TypeIdentifier<D>,
    eventIdentifierE: TypeIdentifier<E>,
    observable: Observable<
      TypedEvent<A> | TypedEvent<B> | TypedEvent<C> | TypedEvent<D> | TypedEvent<E>
    >,
    subscribeObservableOnlyIfEventIsSubscribed: TypeIdentifier<any> | null = null,
  ): void {
    this.assertSourceExists(sourceIdentifier, sourceIdentifier);
    const sharedSource = this.getDependentObservable(
      observable.pipe(delay(1, asyncScheduler), share()),
      subscribeObservableOnlyIfEventIsSubscribed,
    );
    this.addTypedEventSource(
      sourceIdentifier,
      eventIdentifierA,
      sharedSource as Observable<TypedEvent<A>>,
    );
    this.addTypedEventSource(
      sourceIdentifier,
      eventIdentifierB,
      sharedSource as Observable<TypedEvent<B>>,
    );
    this.addTypedEventSource(
      sourceIdentifier,
      eventIdentifierC,
      sharedSource as Observable<TypedEvent<C>>,
    );
    this.addTypedEventSource(
      sourceIdentifier,
      eventIdentifierD,
      sharedSource as Observable<TypedEvent<D>>,
    );
    this.addTypedEventSource(
      sourceIdentifier,
      eventIdentifierE,
      sharedSource as Observable<TypedEvent<E>>,
    );
  }

  /**
   * See add2TypedEventSource
   *
   * @param {symbol} sourceIdentifier - each source must be uniquely identified by a symbol
   * @param {TypeIdentifier<A>} eventIdentifierA - the unique identifier for event type A
   * @param {TypeIdentifier<B>} eventIdentifierB - the unique identifier for event type B
   * @param {TypeIdentifier<C>} eventIdentifierC - the unique identifier for event type C
   * @param {TypeIdentifier<D>} eventIdentifierD - the unique identifier for event type D
   * @param {TypeIdentifier<E>} eventIdentifierE - the unique identifier for event type E
   * @param {TypeIdentifier<F>} eventIdentifierF - the unique identifier for event type F
   * @param {Observable<TypedEvent<A> | TypedEvent<B> | TypedEvent<C> | TypedEvent<D> | TypedEvent<E> | TypedEvent<F>>} observable - the event source
   * @param {TypeIdentifier<any> | null} subscribeObservableOnlyIfEventIsSubscribed - defaults to null
   * @returns {void}
   */
  add6TypedEventSource<A, B, C, D, E, F>(
    sourceIdentifier: symbol,
    eventIdentifierA: TypeIdentifier<A>,
    eventIdentifierB: TypeIdentifier<B>,
    eventIdentifierC: TypeIdentifier<C>,
    eventIdentifierD: TypeIdentifier<D>,
    eventIdentifierE: TypeIdentifier<E>,
    eventIdentifierF: TypeIdentifier<F>,
    observable: Observable<
      TypedEvent<A> | TypedEvent<B> | TypedEvent<C> | TypedEvent<D> | TypedEvent<E> | TypedEvent<F>
    >,
    subscribeObservableOnlyIfEventIsSubscribed: TypeIdentifier<any> | null = null,
  ): void {
    this.assertSourceExists(sourceIdentifier, sourceIdentifier);
    const sharedSource = this.getDependentObservable(
      observable.pipe(delay(1, asyncScheduler), share()),
      subscribeObservableOnlyIfEventIsSubscribed,
    );
    this.addTypedEventSource(
      sourceIdentifier,
      eventIdentifierA,
      sharedSource as Observable<TypedEvent<A>>,
    );
    this.addTypedEventSource(
      sourceIdentifier,
      eventIdentifierB,
      sharedSource as Observable<TypedEvent<B>>,
    );
    this.addTypedEventSource(
      sourceIdentifier,
      eventIdentifierC,
      sharedSource as Observable<TypedEvent<C>>,
    );
    this.addTypedEventSource(
      sourceIdentifier,
      eventIdentifierD,
      sharedSource as Observable<TypedEvent<D>>,
    );
    this.addTypedEventSource(
      sourceIdentifier,
      eventIdentifierE,
      sharedSource as Observable<TypedEvent<E>>,
    );
    this.addTypedEventSource(
      sourceIdentifier,
      eventIdentifierF,
      sharedSource as Observable<TypedEvent<F>>,
    );
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
   * be a strong indicator of flawed design, because it would mean your code is not reactive).
   * If this store has a parent store, events from both, parent and child will be observed (merged).
   *
   * @param {TypeIdentifier<T>} identifier - the unique identifier for the event
   * @returns {Observable<T>} - the behavior observable for the events (with delay(1, asyncScheduler) and share())
   */
  getEventStream<T>(identifier: TypeIdentifier<T>): Observable<T> {
    return merge(
      this.getEventStreamControlledSubject(identifier).getObservable(),
      this.parentStore ? this.parentStore.getEventStream(identifier) : NEVER,
    );
  }

  /**
   * Like getEventStream, but receiving TypedEvent<T> instead of T.
   *
   * @param {TypeIdentifier<T>} identifier - the unique identifier for the event
   * @returns {Observable<TypedEvent<T>>} - the observable for the typed events
   */
  getTypedEventStream<T>(identifier: TypeIdentifier<T>): Observable<TypedEvent<T>> {
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
   * The isSubscribed method is a convenience method for testing and debugging and should
   * not serve any purpose in real program logic.
   *
   * @param {TypeIdentifier<T>} identifier - the unique identifier for the behavior or event
   * @returns {boolean} - true, if the corresponding event or behavior is currently subscribed
   */
  isSubscribed<T>(identifier: TypeIdentifier<T>): boolean {
    return (
      this.behaviors.get(identifier.symbol)?.isObservableSubscribed() === true ||
      this.eventStreams.get(identifier.symbol)?.isObservableSubscribed() === true
    );
  }

  /**
   * The getIsSubscribedObservable method is the reactive counterpart for the isSubscribed method,
   * also serving mainly for testing and debugging purposes (though in contrast to the non-reactive
   * counterpart, you could actually use this in some scenarios, but there are likely more idiomatic
   * ways).
   *
   * @param {TypeIdentifier<T>} identifier - the unique identifier for the behavior or event
   * @returns {Observable<boolean>} - upon subscription, lets you keep track whether the corresponding event or behavior is subscribed
   */
  getIsSubscribedObservable<T>(identifier: TypeIdentifier<T>): Observable<boolean> {
    const sym = identifier.symbol;
    return combineLatest([
      this.behaviorsSubject
        .asObservable()
        .pipe(switchMap(s => s.get(sym)?.getIsSubscribedObservable() ?? of(false))),
      this.eventStreamsSubject
        .asObservable()
        .pipe(switchMap(s => s.get(sym)?.getIsSubscribedObservable() ?? of(false))),
    ]).pipe(
      map(([s1, s2]) => s1 || s2),
      distinctUntilChanged(),
      share(),
    );
  }

  /**
   * The getNumberOfBehaviorSources method returns the number of sources for the specified behavior.
   * Again, this is mostly for testing and debugging.
   *
   * @param {TypeIdentifier<T>} identifier - the unique identifier for the behavior
   * @returns {number} - the current number of sources for the specified behavior
   */
  getNumberOfBehaviorSources<T>(identifier: TypeIdentifier<T>): number {
    return this.getBehaviorControlledSubject(identifier).getNumberOfSources();
  }

  /**
   * The getNumberOfEventSources method returns the number of sources for the specified event.
   * Again, this is mostly for testing and debugging.
   *
   * @param {TypeIdentifier<T>} identifier - the unique identifier for the event
   * @returns {number} - the current number of sources for the specified event
   */
  getNumberOfEventSources<T>(eventIdentifier: TypeIdentifier<T>): number {
    return this.getEventStreamControlledSubject(eventIdentifier).getNumberOfSources();
  }

  private getDependentObservable<T>(
    observable: Observable<T>,
    subscribeObservableOnlyIfEventIsSubscribed: TypeIdentifier<any> | null,
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
    eventIdentifier: TypeIdentifier<T>,
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

  private createBehaviorControlledSubject<T>(identifier: TypeIdentifier<T>): ControlledSubject<T> {
    const controlledSubject = new ControlledSubject<T>(
      identifier.symbol,
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
    this.behaviors.set(identifier.symbol, controlledSubject);
    this.behaviorsSubject.next(this.behaviors);
    return controlledSubject;
  }

  private getBehaviorControlledSubject<T>(identifier: TypeIdentifier<T>): ControlledSubject<T> {
    return (
      this.behaviors.get(identifier.symbol) ?? this.createBehaviorControlledSubject(identifier)
    );
  }

  private createEventStreamControlledSubject<T>(
    identifier: TypeIdentifier<T>,
  ): ControlledSubject<T> {
    const controlledSubject = new ControlledSubject<T>(
      identifier.symbol,
      false,
      (_, error) => {
        // If a source errors, error for the target.
        controlledSubject.error(error);
      },
      id => {
        // If the source completes, we can remove it.
        // However, we cannot complete the target, even if it was the last source, because store.dispatchEvent
        // is also a valid (never completing) source. Also, new sources might be added at a later point of time.
        controlledSubject.removeSource(id);
      },
      this.delayedEventQueue,
    );
    this.eventStreams.set(identifier.symbol, controlledSubject);
    this.eventStreamsSubject.next(this.eventStreams);
    return controlledSubject;
  }

  private getEventStreamControlledSubject<T>(identifier: TypeIdentifier<T>): ControlledSubject<T> {
    return (
      this.eventStreams.get(identifier.symbol) ??
      this.createEventStreamControlledSubject(identifier)
    );
  }

  private assertSourceExists(symbol: symbol, sourceIdentifier: symbol): void {
    if (
      (this.behaviors.has(symbol) && this.behaviors.get(symbol)?.hasSource(sourceIdentifier)) ||
      (this.eventStreams.has(symbol) && this.eventStreams.get(symbol)?.hasSource(sourceIdentifier))
    ) {
      throw new Error(
        `A behavior or event source with the given identifier was already added with a source: ${symbol.toString()}`,
      );
    }
  }
}
