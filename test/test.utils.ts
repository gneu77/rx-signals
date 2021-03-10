import { scan, skip, take, timeout } from 'rxjs/operators';
import { Observable } from 'rxjs';

export const expectSequence = (
  observable: Observable<any>,
  sequence: any[],
  timeoutAfter: number = 500,
): Promise<void> => {
  return new Promise<void>(resolve => {
    observable
      .pipe(
        scan((acc: any[], next: any) => [...acc, next], []),
        skip(sequence.length - 1),
        take(1),
        timeout(timeoutAfter),
      )
      .subscribe(acc => {
        expect(acc).toEqual(sequence);
        resolve();
      });
  });
};
