import { combineLatest, Observable, of } from 'rxjs';
import { catchError, delay, filter, map, scan, startWith, take, timeout } from 'rxjs/operators';

export const getSequence = async (
  observable: Observable<any>,
  length: number,
  timeoutAfter: number = 3000, // Jest can be slow sometimes...
): Promise<any[]> => {
  const accObservable = observable.pipe(
    scan((acc: any[], next: any) => [...acc, next], []),
    startWith([]),
  );
  const timeoutObservable = of(true).pipe(delay(timeoutAfter), startWith(false));
  return combineLatest([accObservable, timeoutObservable])
    .pipe(
      filter(([result, timeout]) => timeout || result.length === length),
      map(([result]) => result),
      take(1),
    )
    .toPromise();
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
