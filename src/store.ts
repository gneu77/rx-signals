import { asyncScheduler, BehaviorSubject, combineLatest, NEVER, Observable, of } from 'rxjs';
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
import { NO_VALUE, SourceObservable } from './source-observable';

export interface TypeIdentifier<T> {
  _typeTemplate?: T | undefined; // should always be undefined (just here to make TS happy)
  readonly symbol: symbol;
}

export interface TypedEvent<T> {
  type: TypeIdentifier<T>;
  event: T;
}

export type StateReducer<T, E> = (state: T, event: E) => T;

export class Store {
  private behaviors = new Map<symbol, ControlledSubject<any>>();

  private eventStreams = new Map<symbol, ControlledSubject<any>>();

  private behaviorsSubject = new BehaviorSubject<Map<symbol, ControlledSubject<any>>>(
    new Map<symbol, ControlledSubject<any>>(),
  );

  private eventStreamsSubject = new BehaviorSubject<Map<symbol, ControlledSubject<any>>>(
    new Map<symbol, ControlledSubject<any>>(),
  );

  isSubscribed<T>(identifier: TypeIdentifier<T>): boolean {
    return (
      this.behaviors.get(identifier.symbol)?.isObservableSubscribed() === true ||
      this.eventStreams.get(identifier.symbol)?.isObservableSubscribed() === true
    );
  }

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

  addLazyBehavior<T>(
    identifier: TypeIdentifier<T>,
    observable: Observable<T>,
    initialValueOrValueGetter: T | (() => T) | symbol = NO_VALUE,
  ): void {
    this.addBehavior(identifier, observable, true, initialValueOrValueGetter);
  }

  addNonLazyBehavior<T>(
    identifier: TypeIdentifier<T>,
    observable: Observable<T>,
    initialValueOrValueGetter: T | (() => T) | symbol = NO_VALUE,
  ): void {
    this.addBehavior(identifier, observable, false, initialValueOrValueGetter);
  }

  addState<T>(identifier: TypeIdentifier<T>, initialValueOrValueGetter: T | (() => T)): void {
    this.assertSourceExists(identifier.symbol, identifier.symbol);
    this.getBehaviorControlledSubject(identifier).addSource(
      new SourceObservable<T>(identifier.symbol, NEVER, false, initialValueOrValueGetter),
    );
  }

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

  removeReducer<T, E>(
    stateIdentifier: TypeIdentifier<T>,
    eventIdentifier: TypeIdentifier<E>,
  ): void {
    this.getBehaviorControlledSubject(stateIdentifier).removeSource(eventIdentifier.symbol);
  }

  removeBehaviorSources<T>(identifier: TypeIdentifier<T>): void {
    const behavior = this.getBehaviorControlledSubject(identifier);
    behavior.removeAllSources();
  }

  completeBehavior<T>(identifier: TypeIdentifier<T>): void {
    const behavior = this.getBehaviorControlledSubject(identifier);
    behavior.removeAllSources();
    behavior.complete();
    this.behaviors.delete(identifier.symbol);
    this.behaviorsSubject.next(this.behaviors);
  }

  getBehavior<T>(identifier: TypeIdentifier<T>): Observable<T> {
    return this.getBehaviorControlledSubject(identifier).getObservable();
  }

  resetBehaviors() {
    const resetHandles = [...this.behaviors.values()].map(behavior => behavior.getResetHandle());
    resetHandles.forEach(handle => handle.removeSources());
    resetHandles.forEach(handle => handle.readdSources());
  }

  getNumberOfBehaviorSources<T>(identifier: TypeIdentifier<T>): number {
    return this.getBehaviorControlledSubject(identifier).getNumberOfSources();
  }

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

  add2TypedEventSource<A, B>(
    sourceIdentifier: symbol,
    eventIdentifierA: TypeIdentifier<A>,
    eventIdentifierB: TypeIdentifier<B>,
    observable: Observable<TypedEvent<A> | TypedEvent<B>>,
    subscribeObservableOnlyIfEventIsSubscribed: TypeIdentifier<any> | null = null,
  ): void {
    this.assertSourceExists(sourceIdentifier, sourceIdentifier);
    const sharedSource = observable.pipe(share());
    this.addTypedEventSource(
      sourceIdentifier,
      eventIdentifierA,
      sharedSource as Observable<TypedEvent<A>>,
      subscribeObservableOnlyIfEventIsSubscribed,
    );
    this.addTypedEventSource(
      sourceIdentifier,
      eventIdentifierB,
      sharedSource as Observable<TypedEvent<B>>,
      subscribeObservableOnlyIfEventIsSubscribed,
    );
  }

  add3TypedEventSource<A, B, C>(
    sourceIdentifier: symbol,
    eventIdentifierA: TypeIdentifier<A>,
    eventIdentifierB: TypeIdentifier<B>,
    eventIdentifierC: TypeIdentifier<C>,
    observable: Observable<TypedEvent<A> | TypedEvent<B> | TypedEvent<C>>,
    subscribeObservableOnlyIfEventIsSubscribed: TypeIdentifier<any> | null = null,
  ): void {
    this.assertSourceExists(sourceIdentifier, sourceIdentifier);
    const sharedSource = observable.pipe(share());
    this.addTypedEventSource(
      sourceIdentifier,
      eventIdentifierA,
      sharedSource as Observable<TypedEvent<A>>,
      subscribeObservableOnlyIfEventIsSubscribed,
    );
    this.addTypedEventSource(
      sourceIdentifier,
      eventIdentifierB,
      sharedSource as Observable<TypedEvent<B>>,
      subscribeObservableOnlyIfEventIsSubscribed,
    );
    this.addTypedEventSource(
      sourceIdentifier,
      eventIdentifierC,
      sharedSource as Observable<TypedEvent<C>>,
      subscribeObservableOnlyIfEventIsSubscribed,
    );
  }

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
    const sharedSource = observable.pipe(share());
    this.addTypedEventSource(
      sourceIdentifier,
      eventIdentifierA,
      sharedSource as Observable<TypedEvent<A>>,
      subscribeObservableOnlyIfEventIsSubscribed,
    );
    this.addTypedEventSource(
      sourceIdentifier,
      eventIdentifierB,
      sharedSource as Observable<TypedEvent<B>>,
      subscribeObservableOnlyIfEventIsSubscribed,
    );
    this.addTypedEventSource(
      sourceIdentifier,
      eventIdentifierC,
      sharedSource as Observable<TypedEvent<C>>,
      subscribeObservableOnlyIfEventIsSubscribed,
    );
    this.addTypedEventSource(
      sourceIdentifier,
      eventIdentifierD,
      sharedSource as Observable<TypedEvent<D>>,
      subscribeObservableOnlyIfEventIsSubscribed,
    );
  }

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
    const sharedSource = observable.pipe(share());
    this.addTypedEventSource(
      sourceIdentifier,
      eventIdentifierA,
      sharedSource as Observable<TypedEvent<A>>,
      subscribeObservableOnlyIfEventIsSubscribed,
    );
    this.addTypedEventSource(
      sourceIdentifier,
      eventIdentifierB,
      sharedSource as Observable<TypedEvent<B>>,
      subscribeObservableOnlyIfEventIsSubscribed,
    );
    this.addTypedEventSource(
      sourceIdentifier,
      eventIdentifierC,
      sharedSource as Observable<TypedEvent<C>>,
      subscribeObservableOnlyIfEventIsSubscribed,
    );
    this.addTypedEventSource(
      sourceIdentifier,
      eventIdentifierD,
      sharedSource as Observable<TypedEvent<D>>,
      subscribeObservableOnlyIfEventIsSubscribed,
    );
    this.addTypedEventSource(
      sourceIdentifier,
      eventIdentifierE,
      sharedSource as Observable<TypedEvent<E>>,
      subscribeObservableOnlyIfEventIsSubscribed,
    );
  }

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
    const sharedSource = observable.pipe(share());
    this.addTypedEventSource(
      sourceIdentifier,
      eventIdentifierA,
      sharedSource as Observable<TypedEvent<A>>,
      subscribeObservableOnlyIfEventIsSubscribed,
    );
    this.addTypedEventSource(
      sourceIdentifier,
      eventIdentifierB,
      sharedSource as Observable<TypedEvent<B>>,
      subscribeObservableOnlyIfEventIsSubscribed,
    );
    this.addTypedEventSource(
      sourceIdentifier,
      eventIdentifierC,
      sharedSource as Observable<TypedEvent<C>>,
      subscribeObservableOnlyIfEventIsSubscribed,
    );
    this.addTypedEventSource(
      sourceIdentifier,
      eventIdentifierD,
      sharedSource as Observable<TypedEvent<D>>,
      subscribeObservableOnlyIfEventIsSubscribed,
    );
    this.addTypedEventSource(
      sourceIdentifier,
      eventIdentifierE,
      sharedSource as Observable<TypedEvent<E>>,
      subscribeObservableOnlyIfEventIsSubscribed,
    );
    this.addTypedEventSource(
      sourceIdentifier,
      eventIdentifierF,
      sharedSource as Observable<TypedEvent<F>>,
      subscribeObservableOnlyIfEventIsSubscribed,
    );
  }

  removeEventSource(sourceIdentifier: symbol): void {
    this.eventStreams.forEach(cs => cs.removeSource(sourceIdentifier));
  }

  getEventStream<T>(identifier: TypeIdentifier<T>): Observable<T> {
    return this.getEventStreamControlledSubject(identifier).getObservable();
  }

  getTypedEventStream<T>(identifier: TypeIdentifier<T>): Observable<TypedEvent<T>> {
    return this.getEventStreamControlledSubject(identifier)
      .getObservable()
      .pipe(
        map(event => ({
          type: identifier,
          event,
        })),
      );
  }

  getNumberOfEventSources<T>(eventIdentifier: TypeIdentifier<T>): number {
    return this.getEventStreamControlledSubject(eventIdentifier).getNumberOfSources();
  }

  private addTypedEventSource<T>(
    sourceIdentifier: symbol,
    eventIdentifier: TypeIdentifier<T>,
    sharedSource: Observable<TypedEvent<T>>,
    subscribeObservableOnlyIfEventIsSubscribed: TypeIdentifier<any> | null,
  ): void {
    const source = sharedSource.pipe(
      filter(typedEvent => typedEvent.type === eventIdentifier),
      map(event => event.event),
    );
    if (subscribeObservableOnlyIfEventIsSubscribed === null) {
      this.getEventStreamControlledSubject(eventIdentifier).addSource(
        new SourceObservable<T>(sourceIdentifier, source, true),
      );
    } else {
      this.getEventStreamControlledSubject(eventIdentifier).addSource(
        new SourceObservable<T>(
          sourceIdentifier,
          this.getEventStreamControlledSubject(subscribeObservableOnlyIfEventIsSubscribed)
            .getIsSubscribedObservable()
            .pipe(
              switchMap(isSubscribed => (isSubscribed ? source : NEVER)),
              share(),
            ),
          true,
        ),
      );
    }
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
