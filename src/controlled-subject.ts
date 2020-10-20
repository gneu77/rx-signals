import { Observable, Subject, Subscription } from 'rxjs';

export interface SourceObservable<T> {
  id: symbol;
  observable: Observable<T>;
  subscribeLazy: boolean;
  initialValue: T | undefined;
  subscription: Subscription | null;
  subscriptionPending: boolean;
}

export class ControlledSubject<T> {
  private subject: Subject<T>;

  private pipe: Observable<T>;

  private sources: Map<symbol, SourceObservable<T>> = new Map<symbol, SourceObservable<T>>();

  private observable: Observable<T>;

  private isSubscribed: boolean = false;

  constructor(
    private getTargetPipe: (targetSubject: Observable<T>) => Observable<T>, // share or shareReplay
    private onSourceError: (id: symbol, error: any) => void,
    private onSourceCompleted: (id: symbol) => void,
  ) {
    this.subject = new Subject<T>();
    this.pipe = this.getTargetPipe(this.subject.asObservable());
    this.observable = new Observable<T>((subscriber) => {
      const subscription = this.pipe.subscribe(subscriber);
      this.setIsSubscribed(true);
      return () => {
        subscription.unsubscribe();
        if (this.subject.observers.length === 0) {
          this.setIsSubscribed(false);
        }
      };
    });
  }

  getObservable(): Observable<T> {
    return this.observable;
  }

  addSource(sourceId: symbol, sourceObservable: Observable<T>, lazySubscription: boolean, initialValue?: T): void {
    if (this.sources.has(sourceId)) {
      throw new Error(
        `A source with the given ID has already been added. Remove it first, if you want to add a new one.: ${sourceId.toString()}`,
      );
    }
    this.sources.set(sourceId, {
      id: sourceId,
      observable: sourceObservable,
      subscribeLazy: lazySubscription,
      initialValue,
      subscription: null,
      subscriptionPending: false,
    });
    this.setIsSubscribed(this.isSubscribed);
  }

  removeSource(sourceId: symbol): void {
    this.unsubscribe(sourceId);
    this.sources.delete(sourceId);
  }

  next(next: T): void {
    this.subject.next(next);
  }

  error(error: any): void {
    const errorSubject = this.subject;
    this.newSubject();
    errorSubject.error(error);
  }

  complete(): void {
    const completeSubject = this.subject;
    this.newSubject();
    completeSubject.complete();
  }

  isObservableSubscribed(): boolean {
    return this.isSubscribed;
  }

  hasSource(sourceId: symbol): boolean {
    return this.sources.has(sourceId);
  }

  hasAnySource(): boolean {
    return this.sources.size > 0;
  }

  isLazySource(sourceId: symbol): boolean {
    return this.sources.get(sourceId)?.subscribeLazy ?? false;
  }

  private newSubject(): void {
    this.subject = new Subject<T>();
    this.pipe = this.getTargetPipe(this.subject.asObservable());
  }

  private setIsSubscribed(newIsSubscribed: boolean): void {
    this.isSubscribed = newIsSubscribed;
    this.sources.forEach((source) => {
      if (!source.subscribeLazy) {
        // always subscribe (needed for stateful behaviors)
        if (source.subscription === null) {
          this.subscribe(source.id);
        } else {
          this.handleInitialValue(source.id);
        }
        return;
      }
      if (!this.isSubscribed) {
        this.unsubscribe(source.id);
      } else if (this.isSubscribed && source.subscription === null) {
        this.subscribe(source.id);
      }
    });
  }

  private unsubscribe(sourceId: symbol): void {
    const source = this.sources.get(sourceId) ?? null;
    if (source === null) {
      return;
    }
    if (source.subscription !== null) {
      source.subscription.unsubscribe();
      source.subscription = null;
    }
  }

  private subscribe(sourceId: symbol): void {
    const source = this.sources.get(sourceId) ?? null;
    if (source === null) {
      return;
    }
    if (source.subscriptionPending) {
      return;
    }
    source.subscriptionPending = true;
    try {
      source.subscription = source.observable.subscribe(
        (next) => {
          this.subject.next(next);
        },
        (error) => {
          this.onSourceError(source.id, error);
        },
        () => {
          this.onSourceCompleted(source.id);
        },
      );
      this.handleInitialValue(sourceId);
    } finally {
      source.subscriptionPending = false;
    }
  }

  private handleInitialValue(sourceId: symbol): void {
    const source = this.sources.get(sourceId) ?? null;
    if (source === null) {
      return;
    }
    const nextValue = source.initialValue;
    if (nextValue !== undefined && this.subject.observers.length > 0) {
      source.initialValue = undefined;
      this.subject.next(nextValue);
    }
  }
}
