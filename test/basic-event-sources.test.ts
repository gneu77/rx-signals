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

    it('should dispatch event, if subscribed', async () => {
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

    it('should provide a typed event stream', async () => {
      const eventStream = store.getTypedEventStream(testEvent);
      const sequence = expectSequence(eventStream, [
        { type: testEvent, event: 'TEST1' },
        { type: testEvent, event: 'TEST2' },
      ]);

      store.dispatchEvent(testEvent, 'TEST1');
      store.dispatchEvent(testEvent, 'TEST2');

      await sequence;
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

  describe('with typed sources', () => {
    const sourceId = Symbol('SourceId');
    const testEvent2: TypeIdentifier<string> = { symbol: Symbol('TestEvent2') };
    const testEvent3: TypeIdentifier<string> = { symbol: Symbol('TestEvent3') };
    const testEvent4: TypeIdentifier<string> = { symbol: Symbol('TestEvent4') };
    const testEvent5: TypeIdentifier<string> = { symbol: Symbol('TestEvent5') };
    const testEvent6: TypeIdentifier<string> = { symbol: Symbol('TestEvent6') };

    it('should work with event sources that emit 2 different event types', async () => {
      store.add2TypedEventSource(
        sourceId,
        testEvent,
        testEvent2,
        of(
          {
            type: testEvent,
            event: 'testEvent1',
          },
          {
            type: testEvent2,
            event: 'testEvent2',
          },
        ),
      );
      expect(store.getNumberOfEventSources(testEvent)).toBe(1);
      expect(store.getNumberOfEventSources(testEvent2)).toBe(1);

      const eventStream1 = store.getEventStream(testEvent);
      const eventStream2 = store.getEventStream(testEvent2);

      const sequence1 = expectSequence(eventStream1, ['testEvent1']);
      const sequence2 = expectSequence(eventStream2, ['testEvent2']);

      await sequence1;
      await sequence2;
    });

    it('should work with event sources that emit 3 different event types', async () => {
      store.add3TypedEventSource(
        sourceId,
        testEvent,
        testEvent2,
        testEvent3,
        of(
          {
            type: testEvent,
            event: 'testEvent1',
          },
          {
            type: testEvent2,
            event: 'testEvent2',
          },
          {
            type: testEvent3,
            event: 'testEvent3',
          },
        ),
      );
      expect(store.getNumberOfEventSources(testEvent)).toBe(1);
      expect(store.getNumberOfEventSources(testEvent2)).toBe(1);
      expect(store.getNumberOfEventSources(testEvent3)).toBe(1);

      const eventStream1 = store.getEventStream(testEvent);
      const eventStream2 = store.getEventStream(testEvent2);
      const eventStream3 = store.getEventStream(testEvent3);

      const sequence1 = expectSequence(eventStream1, ['testEvent1']);
      const sequence2 = expectSequence(eventStream2, ['testEvent2']);
      const sequence3 = expectSequence(eventStream3, ['testEvent3']);

      await sequence1;
      await sequence2;
      await sequence3;
    });

    it('should work with event sources that emit 4 different event types', async () => {
      store.add4TypedEventSource(
        sourceId,
        testEvent,
        testEvent2,
        testEvent3,
        testEvent4,
        of({
          type: testEvent4,
          event: 'testEvent4',
        }),
      );
      expect(store.getNumberOfEventSources(testEvent)).toBe(1);
      expect(store.getNumberOfEventSources(testEvent2)).toBe(1);
      expect(store.getNumberOfEventSources(testEvent3)).toBe(1);
      expect(store.getNumberOfEventSources(testEvent4)).toBe(1);

      const eventStream4 = store.getEventStream(testEvent4);

      await expectSequence(eventStream4, ['testEvent4']);
    });

    it('should work with event sources that emit 5 different event types', async () => {
      store.add5TypedEventSource(
        sourceId,
        testEvent,
        testEvent2,
        testEvent3,
        testEvent4,
        testEvent5,
        of({
          type: testEvent5,
          event: 'testEvent5',
        }),
      );
      expect(store.getNumberOfEventSources(testEvent)).toBe(1);
      expect(store.getNumberOfEventSources(testEvent2)).toBe(1);
      expect(store.getNumberOfEventSources(testEvent3)).toBe(1);
      expect(store.getNumberOfEventSources(testEvent4)).toBe(1);
      expect(store.getNumberOfEventSources(testEvent5)).toBe(1);

      const eventStream5 = store.getEventStream(testEvent5);

      await expectSequence(eventStream5, ['testEvent5']);
    });

    it('should work with event sources that emit 6 different event types', async () => {
      store.add6TypedEventSource(
        sourceId,
        testEvent,
        testEvent2,
        testEvent3,
        testEvent4,
        testEvent5,
        testEvent6,
        of({
          type: testEvent6,
          event: 'testEvent6',
        }),
      );
      expect(store.getNumberOfEventSources(testEvent)).toBe(1);
      expect(store.getNumberOfEventSources(testEvent2)).toBe(1);
      expect(store.getNumberOfEventSources(testEvent3)).toBe(1);
      expect(store.getNumberOfEventSources(testEvent4)).toBe(1);
      expect(store.getNumberOfEventSources(testEvent5)).toBe(1);
      expect(store.getNumberOfEventSources(testEvent6)).toBe(1);

      const eventStream6 = store.getEventStream(testEvent6);

      await expectSequence(eventStream6, ['testEvent6']);
    });
  });

  describe('with typed sources that are added/removed depending on other sources', () => {
    const sourceId = Symbol('SourceId');
    const testEvent2: TypeIdentifier<string> = { symbol: Symbol('TestEvent2') };
    it('should add source2 only if source1 is subscribed', async () => {
      store.add2TypedEventSource(
        sourceId,
        testEvent,
        testEvent2,
        of(
          {
            type: testEvent,
            event: 'testEvent1',
          },
          {
            type: testEvent2,
            event: 'testEvent2',
          },
        ),
      );
      expect(store.getNumberOfEventSources(testEvent)).toBe(1);
      expect(store.getNumberOfEventSources(testEvent2)).toBe(1);

      const eventStream1 = store.getEventStream(testEvent);
      const eventStream2 = store.getEventStream(testEvent2);

      const sequence1 = expectSequence(eventStream1, ['testEvent1']);
      const sequence2 = expectSequence(eventStream2, ['testEvent2']);

      await sequence1;
      await sequence2;
    });
  });
});
