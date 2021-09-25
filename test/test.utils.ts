import { combineLatest, Observable, of } from 'rxjs';
import { catchError, delay, filter, map, scan, startWith, take, timeout } from 'rxjs/operators';

export const getSequence = async <T>(
  observable: Observable<T>,
  length: number,
  timeoutAfter: number = 3000, // Jest can be slow sometimes...
): Promise<T[]> => {
  const accObservable: Observable<T[]> = observable.pipe(
    scan((acc: T[], next: T) => [...acc, next], []),
    startWith([] as T[]),
  );
  const timeoutObservable = of(true).pipe(delay(timeoutAfter), startWith(false));
  const combined: Observable<[T[], boolean]> = combineLatest([accObservable, timeoutObservable]);
  return combined
    .pipe(
      filter(([result, timeout]) => timeout || result.length === length),
      map(([result]) => result),
      take(1),
    )
    .toPromise() as Promise<T[]>; // Deprecated and will be removed in rxjs8
                                  // However, we must still support rxjs 6.x as peer dependency
};

export const expectSequence = async (
  observable: Observable<any>,
  sequence: any[],
  timeoutAfter: number = 3000, // Jest can be slow sometimes...
): Promise<void> => {
  return getSequence(observable, sequence.length, timeoutAfter).then(result => {
    expect(result).toEqual(sequence);
  });
};

export const awaitStringifyEqualState = async (
  observable: Observable<any>,
  expectedState: any,
  timeoutAfter: number = 3000,
): Promise<void> =>
  new Promise<void>(resolve => {
    observable
      .pipe(
        filter(state => JSON.stringify(state) === JSON.stringify(expectedState)),
        take(1),
        timeout(timeoutAfter),
      )
      .subscribe(() => {
        resolve();
      });
  });

export const awaitError = async (
  observable: Observable<any>,
  timeoutAfter: number = 3000,
): Promise<void> =>
  new Promise<void>(resolve => {
    observable
      .pipe(
        map(() => null),
        catchError(error => of(error)),
        filter(value => value !== null),
        take(1),
        timeout(timeoutAfter),
      )
      .subscribe(() => {
        resolve();
      });
  });

export const awaitCompletion = async (observable: Observable<any>): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    observable.subscribe(() => {}, reject, resolve);
  });

export const withSubscription = async (
  observable: Observable<any>,
  callback: () => Promise<void>,
): Promise<void> => {
  const subscription = observable.subscribe();
  await callback();
  subscription.unsubscribe();
};
