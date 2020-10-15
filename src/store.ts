import { Observable } from 'rxjs';
import { distinctUntilChanged, share, shareReplay } from 'rxjs/operators';
import { ControlledSubject, getControlledSubject } from './controlled-subject';

export interface TypeIdentifier<T> {
  _typeTemplate?: T | undefined; // should always be undefined (just here to make TS happy)
  readonly symbol: symbol;
}

export class Store {
  private behaviors = new Map<symbol, ControlledSubject<any>>();

  private eventStreams = new Map<symbol, ControlledSubject<any>>();

  isAdded<T>(identifier: TypeIdentifier<T>): boolean {
    if (!identifier?.symbol) {
      throw new Error('identifier.symbol is mandatory');
    }
    return (
      this.behaviors.get(identifier.symbol)?.hasSource() === true ||
      this.eventStreams.get(identifier.symbol)?.hasSource() === true
    );
  }

  isSubscribed<T>(identifier: TypeIdentifier<T>): boolean {
    if (!identifier?.symbol) {
      throw new Error('identifier.symbol is mandatory');
    }
    return (
      this.behaviors.get(identifier.symbol)?.isSubscribed() === true ||
      this.eventStreams.get(identifier.symbol)?.isSubscribed() === true
    );
  }

  getUnsubscribedIdentifiers(): symbol[] {
    return [
      ...[...this.behaviors.entries()].filter((tuple) => tuple[1].isSubscribed() === false).map((tuple) => tuple[0]),
      ...[...this.eventStreams.entries()].filter((tuple) => tuple[1].isSubscribed() === false).map((tuple) => tuple[0]),
    ];
  }

  getNoSourceBehaviorIdentifiers(): symbol[] {
    return [...this.behaviors.entries()].filter((tuple) => tuple[1].hasSource() === false).map((tuple) => tuple[0]);
  }

  addBehavior<T>(
    identifier: TypeIdentifier<T>,
    observable: Observable<T>,
    subscribeLazy: boolean,
    initialValue?: T,
  ): void {
    this.assertTypeExists(identifier?.symbol, observable);
    this.getBehaviorControlledSubject(identifier).addSource(observable, subscribeLazy, initialValue);
  }

  addStatelessBehavior<T>(identifier: TypeIdentifier<T>, observable: Observable<T>, initialValue?: T): void {
    this.addBehavior(identifier, observable, true, initialValue);
  }

  addStatefulBehavior<T>(identifier: TypeIdentifier<T>, observable: Observable<T>, initialValue?: T): void {
    this.addBehavior(identifier, observable, false, initialValue);
  }

  removeBehavior<T>(identifier: TypeIdentifier<T>): void {
    const behavior = this.getBehaviorControlledSubject(identifier);
    behavior.removeSource();
    behavior.complete(false);
    this.behaviors.delete(identifier.symbol);
  }

  getBehavior<T>(identifier: TypeIdentifier<T>): Observable<T> {
    return this.getBehaviorControlledSubject(identifier).observable as Observable<T>;
  }

  dispatchEvent<T>(identifier: TypeIdentifier<T>, event: T): void {
    const controlledSubject = this.getEventStreamControlledSubject(identifier);
    if (controlledSubject.isSubscribed()) {
      controlledSubject.next(event);
    }
  }

  addEventSource<T>(identifier: TypeIdentifier<T>, observable: Observable<T>): void {
    this.assertTypeExists(identifier?.symbol, observable);
    this.getEventStreamControlledSubject(identifier).addSource(observable, true);
  }

  removeEventSource<T>(identifier: TypeIdentifier<T>): void {
    this.getEventStreamControlledSubject(identifier).removeSource();
  }

  getEventStream<T>(identifier: TypeIdentifier<T>): Observable<T> {
    return this.getEventStreamControlledSubject(identifier).observable as Observable<T>;
  }

  private createBehaviorControlledSubject<T>(identifier: TypeIdentifier<T>): ControlledSubject<T> {
    const controlledSubject = getControlledSubject<T>(
      (subject) =>
        subject.pipe(
          distinctUntilChanged(), // behaviors represent a current value, hence pushing the same value twice makes no sense
          shareReplay(1), // for the same reason, multiple evaluation makes no sense and we ensure that there always is a value
        ),
      (error) => {
        // If the source errors, remove it from the behavior and complete for the target.
        // (It is up to the target to just add a new source or remove and add the complete behavior, or even do nothing)
        controlledSubject.removeSource();
        controlledSubject.error(error, true); // replay the latest value with the new subject
      },
      () => {
        // If the source completes, remove it from the behavior and complete for the target.
        // (It is up to the target to just add a new source or remove and add the complete behavior, or even do nothing)
        controlledSubject.removeSource();
        controlledSubject.complete(true); // replay the latest value with the new subject
      },
    );
    this.behaviors.set(identifier.symbol, controlledSubject);
    return controlledSubject;
  }

  private getBehaviorControlledSubject<T>(identifier: TypeIdentifier<T>): ControlledSubject<T> {
    if (!identifier?.symbol) {
      throw new Error('identifier.symbol is mandatory');
    }
    return this.behaviors.get(identifier.symbol) ?? this.createBehaviorControlledSubject(identifier);
  }

  private createEventStreamControlledSubject<T>(identifier: TypeIdentifier<T>): ControlledSubject<T> {
    const controlledSubject = getControlledSubject<T>(
      (subject) => subject.pipe(share()),
      (error) => {
        // If the source errors, remove it and error for the target.
        // (It is up to the target to just add a new source or remove and add the complete event stream, or even do nothing)
        controlledSubject.removeSource();
        controlledSubject.error(error, false);
      },
      () => {
        // If the source comples, remove it and complete for the target.
        // (It is up to the target to just add a new source or remove and add the complete event stream, or even do nothing)
        controlledSubject.removeSource();
        controlledSubject.complete(false);
      },
    );
    this.eventStreams.set(identifier.symbol, controlledSubject);
    return controlledSubject;
  }

  private getEventStreamControlledSubject<T>(identifier: TypeIdentifier<T>): ControlledSubject<T> {
    if (!identifier?.symbol) {
      throw new Error('identifier.symbol is mandatory');
    }
    return this.eventStreams.get(identifier.symbol) ?? this.createEventStreamControlledSubject(identifier);
  }

  private assertTypeExists(symbol: symbol, observable: Observable<any>): void {
    if (!symbol) {
      throw new Error('identifier.symbol is mandatory');
    }
    if (!observable) {
      throw new Error('observable is mandatory');
    }
    if (
      (this.behaviors.has(symbol) && this.behaviors.get(symbol)?.hasSource()) ||
      (this.eventStreams.has(symbol) && this.eventStreams.get(symbol)?.hasSource())
    ) {
      throw new Error(
        `A behavior or event source with the given identifier was already added with a source: ${symbol.toString()}`,
      );
    }
  }
}
