import { combineLatest, firstValueFrom, Observable, of } from 'rxjs';
import { catchError, delay, filter, map, scan, startWith, take, timeout } from 'rxjs/operators';

/**
 * This function is a testing utility.
 * It takes an observable and the expected number of values to be observed.
 * The returned Promise either resolves to an array with the observed values, or rejects on error.
 * If the expected number of values is not observed within the configurable timeout, the Promise resolves
 * with the values observed so far.
 *
 * @template T - type for the values to be observed
 * @param {Observable} observable - the observable.
 * @param {number} length - the expected number of values to be observed before resolving the result-Promise.
 * @param {number} timeoutAfter - the timeout for waiting on the expected number of values. Defaults to 3000ms
 * @returns {Promise}
 */
export const getSequence = async <T>(
  observable: Observable<T>,
  length: number,
  timeoutAfter: number = 3000,
): Promise<T[]> => {
  const accObservable: Observable<T[]> = observable.pipe(
    scan((acc: T[], next: T) => [...acc, next], []),
    startWith([] as T[]),
  );
  const timeoutObservable = of(true).pipe(delay(timeoutAfter), startWith(false));
  const combined: Observable<[T[], boolean]> = combineLatest([accObservable, timeoutObservable]);
  return firstValueFrom(
    combined.pipe(
      filter(([result, hasTimedOut]) => hasTimedOut || result.length === length),
      map(([result]) => result),
      take(1),
    ),
  );
};

/**
 * This function is a testing utility.
 * It takes an observable and array of values.
 * The returned Promise resolves as soon as the number of observed values equals the array-length AND the observed values equal the array-values (using expect with .toEqual).
 * It rejects in all other cases, e.g. if the expected number of values was not observed within the configurable timeout.
 *
 * @template T - type for the values to be observed
 * @param {Observable} observable - the observable.
 * @param {number} sequence - the expected values.
 * @param {number} timeoutAfter - the timeout for waiting on the expected values. Defaults to 3000ms
 * @returns {Promise}
 */
export const expectSequence = async <T>(
  observable: Observable<T>,
  sequence: T[],
  timeoutAfter: number = 3000,
): Promise<void> => {
  return getSequence(observable, sequence.length, timeoutAfter).then(result => {
    expect(result).toEqual(sequence);
  });
};

/**
 * @internal
 */
export const awaitStringifyEqualState = async <T>(
  observable: Observable<T>,
  expectedState: T,
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

/**
 * @internal
 */
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

/**
 * @internal
 */
export const awaitCompletion = async (observable: Observable<any>): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    observable.subscribe({ next: () => {}, error: reject, complete: resolve });
  });

/**
 * @internal
 */
export const withSubscription = async (
  observable: Observable<any>,
  callback: () => Promise<void>,
): Promise<void> => {
  const subscription = observable.subscribe();
  await callback();
  subscription.unsubscribe();
};
