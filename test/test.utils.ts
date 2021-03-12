import { scan, take, timeout, filter, delay, startWith, map } from 'rxjs/operators';
import { combineLatest, Observable, of } from 'rxjs';

export const expectSequence = async (
  observable: Observable<any>,
  sequence: any[],
  timeoutAfter: number = 1000, // Jest can be slow sometimes...
): Promise<void> => {
  const accObservable = observable.pipe(scan((acc: any[], next: any) => [...acc, next], []));
  const timeoutObservable = of(true).pipe(delay(timeoutAfter), startWith(false));
  return combineLatest([accObservable, timeoutObservable])
    .pipe(
      filter(([result, timeout]) => timeout || result.length === sequence.length),
      map(([result]) => result),
      take(1),
    )
    .toPromise()
    .then(result => {
      // the toPromise().then() construct is for shorter stack traces
      expect(result).toEqual(sequence);
    });
};

export const awaitStringifyEqualState = async (
  observable: Observable<any>,
  expectedState: any,
  timeoutAfter: number = 1000,
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
