import { map, mergeMap, Observable, Subject } from 'rxjs';

/**
 * Used by the {@link Store}
 *
 * @internal
 */
export class DelayedEventQueue {
  private queueArray: Subject<void>[] = [];

  getQueueDelayedObservable<T>(observable: Observable<T>): Observable<T> {
    return observable.pipe(mergeMap(value => this.fromDelayedQueue().pipe(map(() => value))));
  }

  private fromDelayedQueue(): Observable<void> {
    const subject = new Subject<void>();
    this.queueSubject(subject);
    return subject.asObservable();
  }

  private queueSubject(subject: Subject<void>): void {
    this.queueArray.push(subject);
    if (this.queueArray.length === 1) {
      this.signalNext();
    }
  }

  private signalNext(): void {
    setTimeout(() => {
      const queueLength = this.queueArray.length;
      // eslint-disable-next-line no-plusplus
      for (let i = 0; i < queueLength; ++i) {
        this.queueArray[0].next();
        this.queueArray.shift();
      }
      if (this.queueArray.length > 0) {
        this.signalNext();
      }
    }, 0);
  }
}

export default DelayedEventQueue;
