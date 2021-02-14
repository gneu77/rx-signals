import { Observable } from 'rxjs';
import { distinctUntilChanged, filter, map, share, shareReplay } from 'rxjs/operators';
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
        .filter((tuple) => tuple[1].isObservableSubscribed() === false)
        .map((tuple) => tuple[0]),
      ...[...this.eventStreams.entries()]
        .filter((tuple) => tuple[1].isObservableSubscribed() === false)
        .map((tuple) => tuple[0]),
    ];
  }

  getNoSourceBehaviorIdentifiers(): symbol[] {
    return [...this.behaviors.entries()].filter((tuple) => tuple[1].hasAnySource() === false).map((tuple) => tuple[0]);
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

  addStatelessBehavior<T>(identifier: TypeIdentifier<T>, observable: Observable<T>, initialValue?: T): void {
    this.addBehavior(identifier, observable, true, initialValue);
  }

  addStatefulBehavior<T>(identifier: TypeIdentifier<T>, observable: Observable<T>, initialValue?: T): void {
    this.addBehavior(identifier, observable, false, initialValue);
  }

  removeBehavior<T>(identifier: TypeIdentifier<T>): void {
    const behavior = this.getBehaviorControlledSubject(identifier);
    behavior.removeSource(identifier.symbol);
    behavior.complete();
    this.behaviors.delete(identifier.symbol);
  }

  getBehavior<T>(identifier: TypeIdentifier<T>): Observable<T> {
    return this.getBehaviorControlledSubject(identifier).getObservable();
  }

  resetBehaviors() {
    const resetHandles = [...this.behaviors.values()].map((behavior) => behavior.getResetHandle());
    resetHandles.forEach((handle) => handle.removeSources());
    resetHandles.forEach((handle) => handle.readdSources());
  }

  dispatchEvent<T>(identifier: TypeIdentifier<T>, event: T): void {
    const controlledSubject = this.getEventStreamControlledSubject(identifier);
    if (controlledSubject.isObservableSubscribed()) {
      controlledSubject.next(event);
    }
  }

  addEventSource<T>(sourceIdentifier: symbol, eventIdentifier: TypeIdentifier<T>, observable: Observable<T>): void {
    this.assertSourceExists(sourceIdentifier, sourceIdentifier);
    this.getEventStreamControlledSubject(eventIdentifier).addSource(
      new SourceObservable<T>(sourceIdentifier, observable, true),
    );
  }

  add2TypedEventSource<A, B>(
    sourceIdentifierA: symbol,
    typeIdentifierA: TypeIdentifier<A>,
    sourceIdentifierB: symbol,
    typeIdentifierB: TypeIdentifier<B>,
    observable: Observable<TypedEvent<A> | TypedEvent<B>>,
  ): void {
    this.assertSourceExists(sourceIdentifierA, sourceIdentifierA);
    this.assertSourceExists(sourceIdentifierB, sourceIdentifierB);
    this.addEventSource<A>(
      sourceIdentifierA,
      typeIdentifierA,
      observable.pipe(
        filter((typedEvent) => typedEvent.type === typeIdentifierA),
        map((event) => event.event as A),
      ),
    );
    this.addEventSource<B>(
      sourceIdentifierB,
      typeIdentifierB,
      observable.pipe(
        filter((typedEvent) => typedEvent.type === typeIdentifierB),
        map((event) => event.event as B),
      ),
    );
  }

  add3TypedEventSource<A, B, C>(
    sourceIdentifierA: symbol,
    typeIdentifierA: TypeIdentifier<A>,
    sourceIdentifierB: symbol,
    typeIdentifierB: TypeIdentifier<B>,
    sourceIdentifierC: symbol,
    typeIdentifierC: TypeIdentifier<C>,
    observable: Observable<TypedEvent<A> | TypedEvent<B> | TypedEvent<C>>,
  ): void {
    this.assertSourceExists(sourceIdentifierA, sourceIdentifierA);
    this.assertSourceExists(sourceIdentifierB, sourceIdentifierB);
    this.assertSourceExists(sourceIdentifierC, sourceIdentifierC);
    this.addEventSource<A>(
      sourceIdentifierA,
      typeIdentifierA,
      observable.pipe(
        filter((typedEvent) => typedEvent.type === typeIdentifierA),
        map((event) => event.event as A),
      ),
    );
    this.addEventSource<B>(
      sourceIdentifierB,
      typeIdentifierB,
      observable.pipe(
        filter((typedEvent) => typedEvent.type === typeIdentifierB),
        map((event) => event.event as B),
      ),
    );
    this.addEventSource<C>(
      sourceIdentifierC,
      typeIdentifierC,
      observable.pipe(
        filter((typedEvent) => typedEvent.type === typeIdentifierC),
        map((event) => event.event as C),
      ),
    );
  }

  removeEventSource(sourceIdentifier: symbol): void {
    this.eventStreams.forEach((cs) => cs.removeSource(sourceIdentifier));
  }

  getEventStream<T>(identifier: TypeIdentifier<T>): Observable<T> {
    return this.getEventStreamControlledSubject(identifier).getObservable();
  }

  getTypedEventStream<T>(identifier: TypeIdentifier<T>): Observable<TypedEvent<T>> {
    return this.getEventStreamControlledSubject(identifier)
      .getObservable()
      .pipe(
        map((event) => ({
          type: identifier,
          event,
        })),
      );
  }

  private createBehaviorControlledSubject<T>(identifier: TypeIdentifier<T>): ControlledSubject<T> {
    const controlledSubject = new ControlledSubject<T>(
      identifier.symbol,
      (subject) =>
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
      (id) => {
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
    return this.behaviors.get(identifier.symbol) ?? this.createBehaviorControlledSubject(identifier);
  }

  private createEventStreamControlledSubject<T>(identifier: TypeIdentifier<T>): ControlledSubject<T> {
    const controlledSubject = new ControlledSubject<T>(
      identifier.symbol,
      (subject) => subject.pipe(share()),
      (id, error) => {
        // If the source errors, remove it and error for the target.
        // (It is up to the target to just add a new source or remove and add the complete event stream, or even do nothing)
        controlledSubject.removeSource(id);
        controlledSubject.error(error);
      },
      (id) => {
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
    return this.eventStreams.get(identifier.symbol) ?? this.createEventStreamControlledSubject(identifier);
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
