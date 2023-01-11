import { Subject } from 'rxjs';
import { Store } from '../src/store';
import { expectSequence } from '../src/test-utils/test-utils';
import {
  TriggerInputSignals,
  TriggerOutputSignals,
  getTriggerSignalsFactory,
} from '../src/trigger-signals-factory';

describe('TriggerSignalsFactory', () => {
  const baseFactory = getTriggerSignalsFactory<number>();

  let store: Store;
  let inputSignals: TriggerInputSignals<number>;
  let outputSignals: TriggerOutputSignals<number>;
  let inputSubject: Subject<number>;

  beforeEach(() => {
    store = new Store();
    const signals = baseFactory.build({});
    signals.setup(store);
    inputSignals = signals.input;
    outputSignals = signals.output;
    inputSubject = new Subject<number>();
    store.connectObservable(inputSubject, inputSignals.triggerInput);
  });

  it('should give the expected sequence for the output behavior', async () => {
    const sequence = expectSequence(store.getBehavior(outputSignals.triggeredOutput), [2, 3, 5]);

    store.dispatch(inputSignals.trigger); // no change, cause no input value yet
    inputSubject.next(1); // no change, cause not tiggered
    inputSubject.next(2); // no change, cause not tiggered
    store.dispatch(inputSignals.trigger); // => 2
    store.dispatch(inputSignals.trigger); // no change, cause same input
    inputSubject.next(2); // no change, cause not tiggered
    store.dispatch(inputSignals.trigger); // no change, cause same input
    inputSubject.next(3); // no change, cause not tiggered
    store.dispatch(inputSignals.trigger); // => 3
    inputSubject.next(4); // no change, cause not tiggered
    inputSubject.next(5); // no change, cause not tiggered
    store.dispatch(inputSignals.trigger); // => 5

    await sequence;
  });

  it('should give the expected sequence for the triggered event', async () => {
    const sequence = expectSequence(store.getEventStream(outputSignals.triggered), [2, 2, 2, 3, 5]);

    store.dispatch(inputSignals.trigger); // no change, cause no input value yet
    inputSubject.next(1); // no change, cause not tiggered
    inputSubject.next(2); // no change, cause not tiggered
    store.dispatch(inputSignals.trigger); // => 2
    store.dispatch(inputSignals.trigger); // => 2
    inputSubject.next(2); // no change, cause not tiggered
    store.dispatch(inputSignals.trigger); // => 2
    inputSubject.next(3); // no change, cause not tiggered
    store.dispatch(inputSignals.trigger); // => 3
    inputSubject.next(4); // no change, cause not tiggered
    inputSubject.next(5); // no change, cause not tiggered
    store.dispatch(inputSignals.trigger); // => 5

    await sequence;
  });
});
