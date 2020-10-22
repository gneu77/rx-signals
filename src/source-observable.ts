import { Observable, Subject, Subscription } from 'rxjs';

export class SourceObservable<T> {
  private subscription: Subscription | null = null;

  private subscriptionPending = false;

  private initValue: T | undefined = undefined;

  private initialValueDispatched = false;

  constructor(
    private sourceId: symbol,
    private sourceObservable: Observable<T>,
    private lazySubscription: boolean,
    initialValue?: T,
  ) {
    this.initValue = initialValue;
  }

  getId(): symbol {
    return this.sourceId;
  }

  isLazySubscription(): boolean {
    return this.lazySubscription;
  }

  resetInitialValueDispatched(): void {
    this.initialValueDispatched = false;
  }

  subscribeIfNecessary(targetSubject: Subject<T>, error: (error: any) => void, complete: () => void): void {
    if (this.subscriptionPending || this.subscription !== null) {
      return;
    }
    this.subscriptionPending = true;
    try {
      // For reset logic (readding sources), it is important to dispatch
      // the initial value before subscribing the source and not after!
      const nextValue = this.initValue;
      if (!this.initialValueDispatched && nextValue !== undefined && targetSubject.observers.length > 0) {
        this.initialValueDispatched = true;
        targetSubject.next(nextValue);
      }
      this.subscription = this.sourceObservable.subscribe(
        (next) => {
          targetSubject.next(next);
        },
        error,
        complete,
      );
    } finally {
      this.subscriptionPending = false;
    }
  }

  unsubscribe(): void {
    if (this.subscription !== null) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  }
}

export default SourceObservable;
