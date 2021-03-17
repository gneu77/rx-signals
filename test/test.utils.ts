import { combineLatest, Observable, of } from 'rxjs';
import { delay, filter, map, scan, startWith, take, timeout } from 'rxjs/operators';

export const expectSequence = async (
  observable: Observable<any>,
  sequence: any[],
  timeoutAfter: number = 1000, // Jest can be slow sometimes...
): Promise<void> => {
  const accObservable = observable.pipe(
    scan((acc: any[], next: any) => [...acc, next], []),
    startWith([]),
  );
  const timeoutObservable = of(true).pipe(delay(timeoutAfter), startWith(false));
  return combineLatest([accObservable, timeoutObservable])
    .pipe(
      filter(([result, timeout]) => timeout || result.length === sequence.length),
      map(([result]) => result),
      take(1),
    )
    .toPromise()
    .then(result => {
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
