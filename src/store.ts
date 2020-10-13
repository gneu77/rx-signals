import { Observable, Subject, Subscription } from 'rxjs';
import { distinctUntilChanged, share, shareReplay } from 'rxjs/operators';

export interface TypeIdentifier<T> {
  _typeTemplate?: T | undefined; // should always be undefined (just here to make TS happy)
  readonly symbol: symbol;
}

interface BehaviorData {
  subject: Subject<any>;
  behavior: Observable<any>;
  subscription: Subscription | null;
}

interface EventSourceData {
  eventSource: Observable<any>;
  eventSourceSubscription: Subscription | null;
}

interface EventStreamData {
  subject: Subject<any>;
  eventStream: Observable<any>;
  numberOfEventSubscriptions: number;
}

export class Store {
  private behaviors = new Map<symbol, BehaviorData>();

  private eventSources = new Map<symbol, EventSourceData>();

  private eventStreams = new Map<symbol, EventStreamData>();

  addBehavior<T>(identifier: TypeIdentifier<T>, observable: Observable<T>): void {
    if (!identifier?.symbol) {
      throw new Error('identifier.symbol is mandatory');
    }
    if (!observable) {
      throw new Error('observable is mandatory');
    }
    this.assertTypeExists(identifier?.symbol);
    const subscription = observable.subscribe(
      (next) => {
        const behaviorData = this.getBehaviorData(identifier);
        const tempSubscription = behaviorData.behavior.subscribe();
        behaviorData.subject.next(next);
        tempSubscription.unsubscribe();
      },
      (error) => {
        console.error(
          'CRITICAL ERROR: a behavior subscription got an error. This must never happen, because behaviors are not allowed to have sideeffects (use event streams for effects).',
        );
        console.error('The error was: ', error);
        this.getBehaviorData(identifier).subject.error(error);
      },
      () => {
        this.removeBehavior(identifier);
      },
    );
    this.behaviors.set(identifier.symbol, {
      ...this.getBehaviorData(identifier),
      subscription,
    });
  }

  removeBehavior<T>(identifier: TypeIdentifier<T>): void {
    const behaviorData = this.getBehaviorData(identifier);
    if (behaviorData.subscription) {
      behaviorData.subscription.unsubscribe();
    }
    behaviorData.subject.complete();
    this.behaviors.delete(identifier.symbol);
  }

  getBehavior<T>(identifier: TypeIdentifier<T>): Observable<T> {
    return this.getBehaviorData(identifier).behavior as Observable<T>;
  }

  getEventStream<T>(identifier: TypeIdentifier<T>): Observable<T> {
    return this.getEventStreamData(identifier).eventStream as Observable<T>;
  }

  dispatchEvent<T>(identifier: TypeIdentifier<T>, event: T): void {
    if (!identifier?.symbol) {
      throw new Error('identifier.symbol is mandatory');
    }
    const eventStreamData = this.getEventStreamData(identifier);
    if (eventStreamData.numberOfEventSubscriptions < 1) {
      // this means there is not yet a listener
      return;
    }
    eventStreamData.subject.next(event);
  }

  addEventSource<T>(identifier: TypeIdentifier<T>, observable: Observable<T>): void {
    if (!identifier?.symbol) {
      throw new Error('identifier.symbol is mandatory');
    }
    if (!observable) {
      throw new Error('observable is mandatory');
    }
    this.assertTypeExists(identifier.symbol);
    this.eventSources.set(identifier.symbol, {
      eventSource: observable,
      eventSourceSubscription: null,
    });
    if (this.getEventStreamData(identifier).numberOfEventSubscriptions > 0) {
      this.subscribeEventSource(identifier.symbol);
    }
  }

  removeEventSource<T>(identifier: TypeIdentifier<T>): void {
    if (!identifier?.symbol) {
      throw new Error('identifier.symbol is mandatory');
    }
    const eventSourceData = this.eventSources.get(identifier.symbol);
    if (!eventSourceData) {
      return;
    }
    if (eventSourceData.eventSourceSubscription) {
      eventSourceData.eventSourceSubscription.unsubscribe();
    }
    this.eventSources.delete(identifier.symbol);
  }

  private createBehaviorData(symbol: symbol): BehaviorData {
    const subject = new Subject();
    const behavior = subject.pipe(
      distinctUntilChanged(), // behaviors represent a current value, hence pushing the same value twice makes no sense
      shareReplay(1), // for the same reason, multiple evaluation makes no sense and we ensure that there always is a value
    );
    const result = {
      subject,
      behavior,
      subscription: null,
    };
    this.behaviors.set(symbol, result);
    return result;
  }

  private getBehaviorData<T>(identifier: TypeIdentifier<T>): BehaviorData {
    if (!identifier?.symbol) {
      throw new Error('identifier.symbol is mandatory');
    }
    return this.behaviors.get(identifier.symbol) ?? this.createBehaviorData(identifier.symbol);
  }

  private assertTypeExists(symbol: symbol): void {
    if (this.behaviors.has(symbol) || this.eventSources.has(symbol)) {
      throw new Error(`A behavior or event source with the given identifier was already added: ${symbol.toString()}`);
    }
  }

  private createEventStreamData(symbol: symbol): EventStreamData {
    const subject = new Subject();
    const sharedSource = subject.pipe(
      share(), // share events among consumers
    );
    let nSubscriptions = 0;
    const eventStream = new Observable((subscriber) => {
      nSubscriptions += 1;
      this.handleNewNumberOfEventSubscriptions(symbol, nSubscriptions);
      const subscription = sharedSource.subscribe(subscriber);
      return () => {
        subscription.unsubscribe();
        nSubscriptions -= 1;
        this.handleNewNumberOfEventSubscriptions(symbol, nSubscriptions);
      };
    });
    const result = {
      subject,
      eventStream,
      numberOfEventSubscriptions: 0,
    };
    this.eventStreams.set(symbol, result);
    return result;
  }

  private handleNewNumberOfEventSubscriptions(symbol: symbol, newNumber: number): void {
    const eventStreamData = this.getEventStreamDataBySymbol(symbol);
    this.eventStreams.set(symbol, {
      ...eventStreamData,
      numberOfEventSubscriptions: newNumber,
    });
    // We only subscribe to an eventsource, if at least one observer subscribes to
    // the corresponding events. That way, we keep the event source lazy evaluated.
    if (eventStreamData.numberOfEventSubscriptions === 0 && newNumber > 0) {
      this.subscribeEventSource(symbol);
    } else if (newNumber === 0 && eventStreamData.numberOfEventSubscriptions > 0) {
      this.unsubscribeEventSource(symbol);
    }
  }

  private getEventStreamDataBySymbol(symbol: symbol): EventStreamData {
    return this.eventStreams.get(symbol) ?? this.createEventStreamData(symbol);
  }

  private getEventStreamData<T>(identifier: TypeIdentifier<T>): EventStreamData {
    if (!identifier?.symbol) {
      throw new Error('identifier.symbol is mandatory');
    }
    return this.getEventStreamDataBySymbol(identifier.symbol);
  }

  private subscribeEventSource(symbol: symbol): void {
    const eventSourceData = this.eventSources.get(symbol);
    if (!eventSourceData) {
      // We can have subscribers without having an event source,
      // but in that case we do not have to do anything here.
      return;
    }
    const eventSourceSubscription = eventSourceData.eventSource.subscribe(
      (event) => {
        this.getEventStreamDataBySymbol(symbol).subject.next(event);
      },
      (error) => {
        const eventStreamData = this.getEventStreamDataBySymbol(symbol);
        eventStreamData.subject.error(error);
        if (eventStreamData.numberOfEventSubscriptions > 0) {
          // We must resubscribe
          this.subscribeEventSource(symbol);
        }
      },
      () => {
        // If a source completes, we remove it.
        // (We do not complete correspoding event streams, because these might still be pushed by dispatchEvent)
        this.eventSources.delete(symbol);
      },
    );
    this.eventSources.set(symbol, {
      ...eventSourceData,
      eventSourceSubscription,
    });
  }

  private unsubscribeEventSource(symbol: symbol): void {
    const eventSourceData = this.eventSources.get(symbol);
    if (eventSourceData?.eventSourceSubscription) {
      eventSourceData.eventSourceSubscription.unsubscribe();
      this.eventSources.set(symbol, {
        ...eventSourceData,
        eventSourceSubscription: null,
      });
    }
  }
}
