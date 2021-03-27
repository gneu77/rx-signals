import { Observable, Subject, Subscription } from 'rxjs';
import { ContextHandle } from './context-handle';

export const NO_VALUE: symbol = Symbol('NO_VALUE');

export class SourceObservable<T> {
  private subscription: Subscription | null = null;

  private subscriptionPending = false;

  private initialValueDispatched = false;

  constructor(
    private sourceId: symbol,
    private sourceObservable: Observable<T>,
    private lazySubscription: boolean,
    private initialValueOrValueGetter: T | (() => T) | symbol = NO_VALUE,
  ) {}

  getId(): symbol {
    return this.sourceId;
  }

  isLazySubscription(): boolean {
    return this.lazySubscription;
  }

  resetInitialValueDispatched(): void {
    this.initialValueDispatched = false;
  }

  subscribeIfNecessary(
    contextHandle: ContextHandle,
    targetSubject: Subject<T>,
    targetObservable: Observable<T>,
    isTargetSubscribed: boolean,
    error: (error: any) => void,
    complete: () => void,
  ): void {
    if (this.subscriptionPending || this.subscription !== null) {
      return;
    }
    this.subscriptionPending = true;
    try {
      // For reset logic (readding sources), it is important to dispatch
      // the initial value before subscribing the source and not after!
      if (!this.initialValueDispatched && this.initialValueOrValueGetter !== NO_VALUE) {
        this.initialValueDispatched = true;
        let targetSubscription: Subscription | null = null;
        if (!isTargetSubscribed) {
          targetSubscription = targetObservable.subscribe();
        }
        const initialValue =
          typeof this.initialValueOrValueGetter === 'function'
            ? (this.initialValueOrValueGetter as () => T)()
            : this.initialValueOrValueGetter;
        targetSubject.next(initialValue as T);
        if (targetSubscription) {
          targetSubscription.unsubscribe();
        }
      }
      contextHandle.withContext(() => {
        this.subscription = this.sourceObservable.subscribe(
          next => {
            targetSubject.next(next);
          },
          error,
          complete,
        );
      });
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
