import { interval, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { Store, TypeIdentifier } from './../src/store';
import { awaitError, expectSequence } from './test.utils';
describe('Event streams', () => {
  const testEvent: TypeIdentifier<string> = { symbol: Symbol('TestEvent') };

  let store: Store;

  beforeEach(() => {
    store = new Store();
  });

  describe('without sources', () => {
    it('should have no sources', () => {
      store.getEventStream(testEvent);
      expect(store.getNumberOfEventSources(testEvent)).toBe(0);
    });

    it('should not be subscribed', () => {
      store.getEventStream(testEvent);
      expect(store.isSubscribed(testEvent)).toBe(false);
    });
    it('should not dispatch event, if not subscribed', async () => {
      store.getEventStream(testEvent);
      const dispatched = await store.dispatchEvent(testEvent, 'TEST');
      expect(dispatched).toBe(false);
    });

    it('should dispatch event, if not subscribed', async () => {
      const eventStream = store.getEventStream(testEvent);
      const sequence = expectSequence(eventStream, ['TEST1', 'TEST2']);

      const dispatched1 = await store.dispatchEvent(testEvent, 'TEST1');
      expect(dispatched1).toBe(true);
      const dispatched2 = await store.dispatchEvent(testEvent, 'TEST2');
      expect(dispatched2).toBe(true);

      await sequence;
      const dispatched3 = await store.dispatchEvent(testEvent, 'TEST3');
      expect(dispatched3).toBe(false);
    });
  });

  describe('with sources', () => {
    const sourceId1 = Symbol('SourceId1');
    const sourceId2 = Symbol('SourceId2');

    it('should add and remove event sources', () => {
      store.addEventSource(sourceId1, testEvent, of('event1', 'event2'));
      store.addEventSource(sourceId2, testEvent, of('event3', 'event4'));
      expect(store.getNumberOfEventSources(testEvent)).toBe(2);
      store.removeEventSource(sourceId1);
      expect(store.getNumberOfEventSources(testEvent)).toBe(1);
    });

    it('should throw, if event source with given identifier already exists', () => {
      store.addEventSource(sourceId1, testEvent, of('event1', 'event2'));
      expect(() => {
        store.addEventSource(sourceId1, testEvent, of('event3', 'event4'));
      }).toThrowError('A source with the given ID has already been added.: Symbol(SourceId1)');
    });

    it('should not be subscribed', () => {
      store.addEventSource(sourceId1, testEvent, of('event1', 'event2'));
      store.getEventStream(testEvent);
      expect(store.isSubscribed(testEvent)).toBe(false);
    });

    it('should subscribe sources and dispatch events, if subscribed', async () => {
      store.addEventSource(sourceId1, testEvent, of('event1', 'event2'));
      store.addEventSource(sourceId2, testEvent, of('event3', 'event4'));
      const eventStream = store.getEventStream(testEvent);
      expect(store.isSubscribed(testEvent)).toBe(false);

      const sequence = expectSequence(eventStream, ['event1', 'event2', 'event3', 'event4']);
      expect(store.isSubscribed(testEvent)).toBe(true);

      await sequence;
    });

    it('should remove completed sources', async () => {
      store.addEventSource(sourceId1, testEvent, of('event1', 'event2'));
      store.addEventSource(sourceId2, testEvent, of('event3', 'event4'));
      const eventStream = store.getEventStream(testEvent);
      expect(store.isSubscribed(testEvent)).toBe(false);
      expect(store.getNumberOfEventSources(testEvent)).toBe(2);

      const sequence = expectSequence(eventStream, ['event1', 'event2']);
      expect(store.isSubscribed(testEvent)).toBe(true);

      await sequence;
      expect(store.getNumberOfEventSources(testEvent)).toBe(0); // because upon subscription, both sources have dispatched immediately
    });

    it('should remove an errored source', async () => {
      store.addEventSource(
        sourceId1,
        testEvent,
        interval(10).pipe(
          map(val => {
            if (val === 3) {
              throw 'ERROR';
            }
            return String(val);
          }),
        ),
      );
      const eventStream = store.getEventStream(testEvent);

      const sequence = expectSequence(eventStream, ['0', '1']);
      const errorSubscription = awaitError(eventStream);

      await sequence;
      expect(store.getNumberOfEventSources(testEvent)).toBe(1);

      await errorSubscription;
      expect(store.getNumberOfEventSources(testEvent)).toBe(0);
    });
  });
});
