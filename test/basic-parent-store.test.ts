import { of } from 'rxjs';
import { Store } from '../src/store';
import { TypeIdentifier } from '../src/store.utils';
import { expectSequence } from './test.utils';

describe('Parent store', () => {
  const idInParent: TypeIdentifier<number> = { symbol: Symbol('ParentBehavior') };
  const idInChild: TypeIdentifier<number> = { symbol: Symbol('ChildBehavior') };
  const idInParentAndChild: TypeIdentifier<number> = { symbol: Symbol('ParentAndChildBehavior') };
  const idInParentAndLaterInChild: TypeIdentifier<number> = {
    symbol: Symbol('ParentAndLaterInChildBehavior'),
  };
  const eventId: TypeIdentifier<number> = { symbol: Symbol('Event') };

  let store: Store;
  let childStore: Store;

  beforeEach(() => {
    store = new Store();
    childStore = store.createChildStore();

    store.addLazyBehavior(idInParent, of(1));
    childStore.addLazyBehavior(idInChild, of(2));
    store.addLazyBehavior(idInParentAndChild, of(3));
    childStore.addLazyBehavior(idInParentAndChild, of(4));
    store.addLazyBehavior(idInParentAndLaterInChild, of(5));
  });

  it('should access behavior from child, if source is available', async () => {
    await expectSequence(childStore.getBehavior(idInChild), [2]);
  });

  it('should access behavior from parent, if no source in child', async () => {
    await expectSequence(childStore.getBehavior(idInParent), [1]);
  });

  it('should access behavior from child, if present in child AND parent', async () => {
    await expectSequence(childStore.getBehavior(idInParentAndChild), [4]);
    await expectSequence(childStore.getBehavior(idInParentAndChild), [3]); // source in child has completed and was thus removed
  });

  it('should access behavior from parent and switch to child, once it becomes available there', async () => {
    await expectSequence(childStore.getBehavior(idInParentAndLaterInChild), [5]);
    store.addLazyBehavior(idInParentAndLaterInChild, of(5));
    childStore.addLazyBehavior(idInParentAndLaterInChild, of(6));
    await expectSequence(childStore.getBehavior(idInParentAndLaterInChild), [6]);
  });

  it('should receive events from both, parent and child, in the child', async () => {
    const sequence = expectSequence(childStore.getEventStream(eventId), [1, 2, 1, 2]);
    childStore.dispatchEvent(eventId, 1);
    store.dispatchEvent(eventId, 2);
    childStore.dispatchEvent(eventId, 1);
    store.dispatchEvent(eventId, 2);
    await sequence;
  });

  it('should receive events only from the parent in parent', async () => {
    const sequence = expectSequence(store.getEventStream(eventId), [2, 2]);
    childStore.dispatchEvent(eventId, 1);
    store.dispatchEvent(eventId, 2);
    childStore.dispatchEvent(eventId, 1);
    store.dispatchEvent(eventId, 2);
    await sequence;
  });
});
