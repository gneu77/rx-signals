import { Observable, Subject, Subscription } from 'rxjs';
import { SourceObservable } from './source-observable';

export interface ResetHandle {
  removeSources(): void;
  readdSources(): void;
}

export class ControlledSubject<T> {
  private subject: Subject<T>;

  private pipe: Observable<T>;

  private sources: Map<symbol, SourceObservable<T>> = new Map<symbol, SourceObservable<T>>();

  private observable: Observable<T>;

  private isSubscribed: boolean = false;

  private selfSubscriptionOrPendingSubscription: Subscription | boolean = false;

  constructor(
    private getTargetPipe: (targetSubject: Observable<T>) => Observable<T>, // share() or shareReplay(1)
    private onSourceError: (sourceId: symbol, error: any) => void,
    private onSourceCompleted: (sourceId: symbol) => void,
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

  addSource(source: SourceObservable<T>): void {
    if (this.sources.has(source.getId())) {
      throw new Error(
        `A source with the given ID has already been added. Remove it first, if you want to add a new one.: ${source
          .getId()
          .toString()}`,
      );
    }
    this.sources.set(source.getId(), source);
    this.setIsSubscribed(this.isSubscribed);
  }

  removeSource(sourceId: symbol): void {
    const source = this.sources.get(sourceId);
    source?.unsubscribe();
    const checkSelfSubscription =
      source?.isLazySubscription() === false &&
      (this.selfSubscriptionOrPendingSubscription as Subscription)?.unsubscribe;
    this.sources.delete(sourceId);
    if (checkSelfSubscription) {
      const statefulSource = [...this.sources.values()].find((s) => !s.isLazySubscription());
      if (!statefulSource) {
        this.unsubscribeSelf();
      }
    }
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

  getResetHandle(): ResetHandle {
    let localSources: SourceObservable<T>[] = [];
    return {
      removeSources: () => {
        localSources = [...this.sources.values()];
        localSources.forEach((source) => {
          this.removeSource(source.getId());
        });
      },
      readdSources: () => {
        localSources.forEach((source) => {
          source.resetInitialValueDispatched();
          this.addSource(source);
        });
      },
    };
  }

  hasSource(sourceId: symbol): boolean {
    return this.sources.has(sourceId);
  }

  hasAnySource(): boolean {
    return this.sources.size > 0;
  }

  isLazySource(sourceId: symbol): boolean {
    return this.sources.get(sourceId)?.isLazySubscription() ?? false;
  }

  private newSubject(): void {
    const localSources = [...this.sources.values()];
    localSources.forEach((source) => {
      this.removeSource(source.getId());
    });
    this.subject = new Subject<T>();
    this.pipe = this.getTargetPipe(this.subject.asObservable());
    localSources.forEach((source) => {
      this.addSource(source);
    });
  }

  private unsubscribeSelf(): void {
    (this.selfSubscriptionOrPendingSubscription as Subscription)?.unsubscribe();
  }

  private setIsSubscribed(newIsSubscribed: boolean): void {
    this.isSubscribed = newIsSubscribed;
    this.sources.forEach((source) => {
      if (!source.isLazySubscription()) {
        // always subscribe (needed for stateful behaviors)
        this.subscribeSource(source);
        return;
      }
      if (!this.isSubscribed) {
        source.unsubscribe();
      } else {
        this.subscribeSource(source);
      }
    });
  }

  private subscribeSource(source: SourceObservable<T>): void {
    if (!source.isLazySubscription() && this.selfSubscriptionOrPendingSubscription === false) {
      this.selfSubscriptionOrPendingSubscription = true;
      this.selfSubscriptionOrPendingSubscription = this.getObservable().subscribe();
    }
    source.subscribeIfNecessary(
      this.subject,
      (error) => {
        this.onSourceError(source.getId(), error);
      },
      () => {
        this.onSourceCompleted(source.getId());
      },
    );
  }
}
