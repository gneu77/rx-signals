import { Subject, of } from 'rxjs';
import { Effect, Store } from '../src/store';
import { expectSequence } from '../src/test-utils/test-utils';
import { NO_VALUE, NoValueType } from './../src/store-utils';
import {
  VoidEffectSignals,
  getVoidEffectSignalsFactory,
} from './../src/void-effect-signals-factory';

describe('void signals factory', () => {
  const inputSubject = new Subject<string>();
  const prevInputSubject = new Subject<string | NoValueType>();
  let executed = 0;
  let errored = 0;
  let store: Store;
  const factory = getVoidEffectSignalsFactory<string>().connectObservable(
    () => inputSubject,
    'inputEvent',
    true,
  );
  let signals: VoidEffectSignals<string>;
  const effect: Effect<string, void> = (input, _, prevInput) => {
    prevInputSubject.next(prevInput);
    if (input === 'throw') {
      errored = errored + 1;
      throw 'BAM';
    }
    executed = executed + 1;
    return of(undefined);
  };

  beforeEach(() => {
    store = new Store();
    executed = 0;
    errored = 0;
    signals = factory.build({});
    signals.setup(store);
  });

  afterEach(() => {
    store.completeAllSignals();
  });

  it('execute the effect on each input', async () => {
    store.addEffect(signals.effects.voidEffect, effect);
    const sequence = expectSequence(prevInputSubject, [NO_VALUE, 'T1', 'T2', 'throw']);
    inputSubject.next('T1');
    inputSubject.next('T2');
    inputSubject.next('throw');
    inputSubject.next('T3');
    await sequence;
    expect(executed).toBe(3);
    expect(errored).toBe(1);
  });

  it('should dispatch errors', async () => {
    store.addEffect(signals.effects.voidEffect, effect);
    const sequence = expectSequence(store.getEventStream(signals.output.errors), [
      {
        error: 'BAM',
        errorInput: 'throw',
      },
    ]);
    inputSubject.next('T1');
    inputSubject.next('T2');
    inputSubject.next('throw');
    inputSubject.next('T3');
    await sequence;
    expect(executed).toBe(3);
    expect(errored).toBe(1);
  });
});
