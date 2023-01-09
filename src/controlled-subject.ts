/* eslint no-underscore-dangle: ["error", { "allow": ["_rxs_id"] }] */
import {
  BehaviorSubject,
  Observable,
  Subject,
  Subscription,
  distinctUntilChanged,
  filter,
  share,
} from 'rxjs';
import { ContextHandle } from './context-handle';
import { DelayedEventQueue } from './delayed-event-queue';
import { SourceObservable } from './source-observable';
import { NO_VALUE } from './store-utils';

/**
 * Used by the {@link Store}
 *
 * rx-signals internal helper type
 */
export type ResetHandle = {
  removeSources(): void;
  readdSources(): void;
};

/**
 * rx-signals internal helper type used by the {@link Store}
 *
 * @class ControlledSubject
 */
export class ControlledSubject<T> {
  private subject!: Subject<T> | BehaviorSubject<T>;

  private pipe: Observable<T>;

  private readonly lazySources: Map<symbol, SourceObservable<T>> = new Map<
    symbol,
    SourceObservable<T>
  >();

  private readonly statefulSources: Map<symbol, SourceObservable<T>> = new Map<
    symbol,
    SourceObservable<T>
  >();

  private observable: Observable<T>;

  private isSubscribed: boolean = false;

  private readonly isSubscribedSubject = new BehaviorSubject<boolean>(false);

  private selfSubscriptionOrPendingSubscription: Subscription | boolean = false;

  private nTargetSubscriptions = 0;

  private readonly contextHandle = new ContextHandle();

  constructor(
    private readonly id: symbol,
    private readonly isBehavior: boolean,
    private readonly onSourceError: (sourceId: symbol, error: any) => void,
    private readonly onSourceCompleted: (sourceId: symbol) => void,
    private readonly delayedEventQueue: DelayedEventQueue,
  ) {
    this.pipe = this.getNewTargetPipe();
    this.observable = new Observable<T>(subscriber => {
      let subscription: Subscription;
      let isCyclic: boolean;
      if (this.isBehavior && !this.isSubscribed) {
        // in case of a behavior, we perform a temporary self-subscription
        // to get the latest value, such that we do not hand-out an outdated value
        // before handing out the most recent one:
        const tmpSubscription = this.pipe.subscribe(() => {});
        isCyclic = this.contextHandle.isInContext;
        if (!isCyclic) {
          this.nTargetSubscriptions += 1;
          this.setIsSubscribed(true);
        }
        subscription = this.pipe.subscribe(subscriber);
        tmpSubscription.unsubscribe();
      } else {
        subscription = this.pipe.subscribe(subscriber);
        isCyclic = this.contextHandle.isInContext;
        if (!isCyclic) {
          this.nTargetSubscriptions += 1;
          this.setIsSubscribed(true);
        }
      }

      return () => {
        subscription.unsubscribe();
        if (!isCyclic) {
          this.nTargetSubscriptions -= 1;
        }
        if (this.nTargetSubscriptions === 0) {
          this.setIsSubscribed(false);
        }
      };
    });
    (this.observable as any)._rxs_id = this.id;
  }

  getObservable(): Observable<T> {
    return this.observable;
  }

  getIsSubscribedObservable(): Observable<boolean> {
    return this.isSubscribedSubject.asObservable();
  }

  addSource(source: SourceObservable<T>): void {
    if (this.lazySources.has(source.getId()) || this.statefulSources.has(source.getId())) {
      throw new Error(
        `A source with the given ID has already been added.: ${source.getId().toString()}`,
      );
    }
    if (source.isLazySubscription()) {
      this.lazySources.set(source.getId(), source);
    } else {
      this.statefulSources.set(source.getId(), source);
    }
    this.setIsSubscribed(this.isSubscribed);
  }

  removeSource(sourceId: symbol): void {
    const source = this.lazySources.get(sourceId) ?? this.statefulSources.get(sourceId);
    if (!source) {
      return;
    }
    source.unsubscribe();
    if (source.isLazySubscription()) {
      this.lazySources.delete(sourceId);
    } else {
      this.statefulSources.delete(sourceId);
    }
    if (this.statefulSources.size < 1) {
      this.unsubscribeSelf();
    }
  }

  removeAllSources(): void {
    this.statefulSources.forEach(source => this.removeSource(source.getId()));
    this.lazySources.forEach(source => this.removeSource(source.getId()));
  }

  next(next: T): void {
    this.subject.next(next);
  }

  error(error: any): void {
    const errorSubject = this.subject;
    this.getNewTargetPipe();
    errorSubject.error(error);
  }

  complete(): void {
    const completeSubject = this.subject;
    this.getNewTargetPipe();
    completeSubject.complete();
  }

  isObservableSubscribed(): boolean {
    return this.isSubscribed;
  }

  getResetHandle(): ResetHandle {
    let localSources: SourceObservable<T>[] = [];
    return {
      removeSources: () => {
        localSources = [...this.lazySources.values(), ...this.statefulSources.values()];
        localSources.forEach(source => {
          this.removeSource(source.getId());
        });
      },
      readdSources: () => {
        localSources.forEach(source => {
          source.resetInitialValueDispatched();
          this.addSource(source);
        });
      },
    };
  }

  hasSource(sourceId: symbol): boolean {
    return this.lazySources.has(sourceId) || this.statefulSources.has(sourceId);
  }

  getNumberOfSources(): number {
    return this.lazySources.size + this.statefulSources.size;
  }

  private getNewTargetPipe(): Observable<T> {
    const localSources = [...this.lazySources.values(), ...this.statefulSources.values()];
    localSources.forEach(source => {
      this.removeSource(source.getId());
    });
    this.subject = this.isBehavior
      ? new BehaviorSubject<T>(NO_VALUE as unknown as T)
      : new Subject<T>();
    this.pipe = this.isBehavior
      ? this.subject.pipe(
          filter(value => value !== (NO_VALUE as unknown as T)),
          distinctUntilChanged(),
        )
      : this.delayedEventQueue.getQueueDelayedObservable(this.subject).pipe(share());
    localSources.forEach(source => {
      this.addSource(source);
    });
    return this.pipe;
  }

  private unsubscribeSelf(): void {
    if (
      typeof (this.selfSubscriptionOrPendingSubscription as Subscription)?.unsubscribe ===
      'function'
    ) {
      (this.selfSubscriptionOrPendingSubscription as Subscription).unsubscribe();
      this.selfSubscriptionOrPendingSubscription = false;
      if (this.nTargetSubscriptions < 1) {
        this.setIsSubscribed(false);
      }
    }
  }

  private setIsSubscribed(newIsSubscribed: boolean): void {
    const changed = this.isSubscribed !== newIsSubscribed;
    this.isSubscribed = newIsSubscribed;
    if (changed) {
      this.isSubscribedSubject.next(this.isSubscribed);
    }
    this.lazySources.forEach(source => {
      if (this.isSubscribed) {
        this.subscribeSource(source);
      } else {
        source.unsubscribe();
      }
    });
    this.statefulSources.forEach(source => {
      // always subscribe (needed for stateful behaviors)
      this.subscribeSource(source);
    });
  }

  private subscribeSource(source: SourceObservable<T>): void {
    if (!source.isLazySubscription() && this.selfSubscriptionOrPendingSubscription === false) {
      this.selfSubscriptionOrPendingSubscription = true;
      this.selfSubscriptionOrPendingSubscription = this.getObservable().subscribe();
      if (this.statefulSources.size < 1) {
        // can happen, if the source has completed synchronously
        this.unsubscribeSelf();
      }
    }
    source.subscribeIfNecessary(
      this.contextHandle,
      this.subject,
      this.getObservable(),
      this.nTargetSubscriptions > 0,
      error => {
        this.onSourceError(source.getId(), error);
      },
      () => {
        this.onSourceCompleted(source.getId());
      },
    );
  }
}
