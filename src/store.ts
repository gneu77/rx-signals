import { asyncScheduler, NEVER, Observable } from 'rxjs';
import {
  delay,
  distinctUntilChanged,
  filter,
  map,
  mapTo,
  share,
  shareReplay,
  take,
  withLatestFrom,
} from 'rxjs/operators';
import { ControlledSubject } from './controlled-subject';
import { SourceObservable } from './source-observable';

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

  isBehaviorAdded<T>(identifier: TypeIdentifier<T>): boolean {
    return this.behaviors.get(identifier.symbol)?.hasAnySource() === true;
  }

  isSubscribed<T>(identifier: TypeIdentifier<T>): boolean {
    return (
      this.behaviors.get(identifier.symbol)?.isObservableSubscribed() === true ||
      this.eventStreams.get(identifier.symbol)?.isObservableSubscribed() === true
    );
  }

  getUnsubscribedIdentifiers(): symbol[] {
    return [
      ...[...this.behaviors.entries()]
        .filter(tuple => tuple[1].isObservableSubscribed() === false)
        .map(tuple => tuple[0]),
      ...[...this.eventStreams.entries()]
        .filter(tuple => tuple[1].isObservableSubscribed() === false)
        .map(tuple => tuple[0]),
    ];
  }

  getNoSourceBehaviorIdentifiers(): symbol[] {
    return [...this.behaviors.entries()]
      .filter(tuple => tuple[1].hasAnySource() === false)
      .map(tuple => tuple[0]);
  }

  addBehavior<T>(
    identifier: TypeIdentifier<T>,
    observable: Observable<T>,
    subscribeLazy: boolean,
    initialValue?: T,
  ): void {
    this.assertSourceExists(identifier.symbol, identifier.symbol);
    this.getBehaviorControlledSubject(identifier).addSource(
      new SourceObservable<T>(identifier.symbol, observable, subscribeLazy, initialValue),
    );
  }

  addStatelessBehavior<T>(
    identifier: TypeIdentifier<T>,
    observable: Observable<T>,
    initialValue?: T,
  ): void {
    this.addBehavior(identifier, observable, true, initialValue);
  }

  addStatefulBehavior<T>(
    identifier: TypeIdentifier<T>,
    observable: Observable<T>,
    initialValue?: T,
  ): void {
    this.addBehavior(identifier, observable, false, initialValue);
  }

  addState<T>(identifier: TypeIdentifier<T>, initialValue: T): void {
    this.assertSourceExists(identifier.symbol, identifier.symbol);
    this.getBehaviorControlledSubject(identifier).addSource(
      new SourceObservable<T>(identifier.symbol, NEVER, false, initialValue),
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

  removeBehavior<T>(identifier: TypeIdentifier<T>): void {
    const behavior = this.getBehaviorControlledSubject(identifier);
    behavior.removeAllSources();
    behavior.complete();
    this.behaviors.delete(identifier.symbol);
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
  ): void {
    this.assertSourceExists(sourceIdentifier, sourceIdentifier);
    const sharedSource = observable.pipe(share());
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

  add3TypedEventSource<A, B, C>(
    sourceIdentifier: symbol,
    eventIdentifierA: TypeIdentifier<A>,
    eventIdentifierB: TypeIdentifier<B>,
    eventIdentifierC: TypeIdentifier<C>,
    observable: Observable<TypedEvent<A> | TypedEvent<B> | TypedEvent<C>>,
  ): void {
    this.assertSourceExists(sourceIdentifier, sourceIdentifier);
    const sharedSource = observable.pipe(share());
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

  add4TypedEventSource<A, B, C, D>(
    sourceIdentifier: symbol,
    eventIdentifierA: TypeIdentifier<A>,
    eventIdentifierB: TypeIdentifier<B>,
    eventIdentifierC: TypeIdentifier<C>,
    eventIdentifierD: TypeIdentifier<D>,
    observable: Observable<TypedEvent<A> | TypedEvent<B> | TypedEvent<C> | TypedEvent<D>>,
  ): void {
    this.assertSourceExists(sourceIdentifier, sourceIdentifier);
    const sharedSource = observable.pipe(share());
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
  ): void {
    this.assertSourceExists(sourceIdentifier, sourceIdentifier);
    const sharedSource = observable.pipe(share());
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
  ): void {
    this.assertSourceExists(sourceIdentifier, sourceIdentifier);
    const sharedSource = observable.pipe(share());
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
  ): void {
    this.getEventStreamControlledSubject(eventIdentifier).addSource(
      new SourceObservable<T>(
        sourceIdentifier,
        sharedSource.pipe(
          filter(typedEvent => typedEvent.type === eventIdentifier),
          map(event => event.event),
        ),
        true,
      ),
    );
  }

  private createBehaviorControlledSubject<T>(identifier: TypeIdentifier<T>): ControlledSubject<T> {
    const controlledSubject = new ControlledSubject<T>(
      identifier.symbol,
      subject =>
        subject.pipe(
          distinctUntilChanged(), // behaviors represent a current value, hence pushing the same value twice makes no sense
          shareReplay(1), // for the same reason, multiple evaluation makes no sense and we ensure that there always is a value
        ),
      (id, error) => {
        // If the source errors, remove it from the behavior and complete for the target.
        // (It is up to the target to just add a new source or remove and add the complete behavior, or even do nothing)
        controlledSubject.removeSource(id);
        controlledSubject.error(error);
      },
      id => {
        // If the source completes, remove it from the behavior and complete for the target.
        // (It is up to the target to just add a new source or remove and add the complete behavior, or even do nothing)
        controlledSubject.removeSource(id);
        controlledSubject.complete();
      },
    );
    this.behaviors.set(identifier.symbol, controlledSubject);
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
      subject =>
        subject.pipe(
          // Always dispatching events asynchronously protects the consumers from strange rxjs behavior
          // that could lead to wrong states when sychronously dispatching event in another event handler.
          delay(1, asyncScheduler),
          share(),
        ),
      (id, error) => {
        // If the source errors, remove it and error for the target.
        // (It is up to the target to just add a new source or remove and add the complete event stream, or even do nothing)
        controlledSubject.removeSource(id);
        controlledSubject.error(error);
      },
      id => {
        // If the source comples, remove it and complete for the target.
        // (It is up to the target to just add a new source or remove and add the complete event stream, or even do nothing)
        controlledSubject.removeSource(id);
        controlledSubject.complete();
      },
    );
    this.eventStreams.set(identifier.symbol, controlledSubject);
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
