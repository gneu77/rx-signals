import { Observable, Subject, Subscription } from 'rxjs';

export interface ControlledSubject<T> {
  observable: Observable<T>;
  addSource(sourceObservable: Observable<T>, lazySubscription: boolean, initialValue?: T): void;
  removeSource(): void;
  next(next: T): void;
  error(error: any, replay: boolean): void;
  complete(replay: boolean): void;
  isSubscribed(): boolean;
  hasSource(): boolean;
  hasLazySource(): boolean;
}

export const getControlledSubject = <T>(
  getTargetPipe: (targetSubject: Observable<T>) => Observable<T>, // share or shareReplay and optional startWith
  onSourceError: (error: any) => void,
  onSourceCompleted: () => void,
): ControlledSubject<T> => {
  let subject: Subject<T>;
  let pipe: Observable<T>;
  let initialValue: T | undefined;
  const newSubject = () => {
    subject = new Subject<T>();
    pipe = getTargetPipe(subject.asObservable());
  };
  newSubject();
  let isSubscribed = false;
  let source: Observable<T> | null = null;
  let subscribeLazy = true;
  let sourceSubscription: Subscription | null = null;
  let latestNext: T | undefined;
  let replayNext: T | undefined;
  let subscriptionPending = false;
  const handleInitialValue = () => {
    const replayValue = replayNext;
    const nextValue = initialValue;
    if (replayValue !== undefined && subject.observers.length > 0) {
      replayNext = undefined;
      subject.next(replayValue);
    } else if (nextValue !== undefined && subject.observers.length > 0) {
      initialValue = undefined;
      subject.next(nextValue);
    }
  };
  const subscribe = (theSource: Observable<T>) => {
    if (subscriptionPending) {
      return;
    }
    subscriptionPending = true;
    try {
      sourceSubscription = theSource.subscribe(
        (next) => {
          latestNext = next;
          subject.next(next);
        },
        (error) => {
          onSourceError(error);
        },
        () => {
          onSourceCompleted();
        },
      );
      handleInitialValue();
    } finally {
      subscriptionPending = false;
    }
  };
  const setIsSubscribed = (newIsSubscribed: boolean) => {
    isSubscribed = newIsSubscribed;
    if (!subscribeLazy) {
      // always subscribe (needed for stateful behaviors)
      if (source !== null && sourceSubscription === null) {
        subscribe(source);
      } else {
        handleInitialValue();
      }
      return;
    }
    if (!isSubscribed && sourceSubscription !== null) {
      sourceSubscription.unsubscribe();
      sourceSubscription = null;
    } else if (isSubscribed && sourceSubscription === null && source !== null) {
      subscribe(source);
    }
  };
  const observable = new Observable<T>((subscriber) => {
    const subscription = pipe.subscribe(subscriber);
    setIsSubscribed(true);
    return () => {
      subscription.unsubscribe();
      if (subject.observers.length === 0) {
        setIsSubscribed(false);
      }
    };
  });
  return {
    observable,
    addSource: (sourceObservable: Observable<T>, lazySubscription, initialVal?) => {
      if (source !== null) {
        throw new Error('A source has already been added. Remove it first, if you want to add a new one.');
      }
      source = sourceObservable;
      subscribeLazy = lazySubscription;
      initialValue = initialVal;
      setIsSubscribed(isSubscribed);
    },
    removeSource: () => {
      source = null;
      initialValue = undefined;
      if (sourceSubscription !== null) {
        sourceSubscription.unsubscribe();
        sourceSubscription = null;
      }
    },
    next: (next: T) => subject.next(next),
    error: (error, replay) => {
      const errorSubject = subject;
      newSubject();
      if (replay && latestNext !== undefined) {
        replayNext = latestNext;
      }
      errorSubject.error(error);
    },
    complete: (replay) => {
      const completeSubject = subject;
      newSubject();
      if (replay && latestNext !== undefined) {
        replayNext = latestNext;
      }
      completeSubject.complete();
    },
    isSubscribed: () => isSubscribed,
    hasSource: () => source !== null,
    hasLazySource: () => source !== null && subscribeLazy,
  };
};
