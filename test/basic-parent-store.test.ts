import { of } from 'rxjs';
import { Store } from '../src/store';
import { getDerivedId, getEventId } from '../src/store-utils';
import { expectSequence } from '../src/test-utils/test-utils';

describe('Parent store', () => {
  const idInParent = getDerivedId<number>();
  const idInChild = getDerivedId<number>();
  const idInParentAndChild = getDerivedId<number>();
  const idInParentAndLaterInChild = getDerivedId<number>();
  const idLaterInChild = getDerivedId<number>();
  const eventId = getEventId<number>();

  let store: Store;
  let childStore: Store;

  beforeEach(() => {
    store = new Store();
    childStore = store.createChildStore();

    store.addDerivedState(idInParent, of(1));
    childStore.addDerivedState(idInChild, of(2));
    store.addDerivedState(idInParentAndChild, of(3));
    childStore.addDerivedState(idInParentAndChild, of(4));
    store.addDerivedState(idInParentAndLaterInChild, of(5));
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
    childStore.addDerivedState(idInParentAndLaterInChild, of(6));
    await expectSequence(childStore.getBehavior(idInParentAndLaterInChild), [6]);
  });

  it('should access non-parent behavior from child, once it becomes available there', async () => {
    const sequence = expectSequence(childStore.getBehavior(idLaterInChild), [7]);
    childStore.addDerivedState(idLaterInChild, of(7));
    await sequence;
  });

  it('should receive events from both, parent and child, in the child', async () => {
    const sequence = expectSequence(childStore.getEventStream(eventId), [1, 2, 1, 2]);
    childStore.dispatch(eventId, 1);
    store.dispatch(eventId, 2);
    childStore.dispatch(eventId, 1);
    store.dispatch(eventId, 2);
    await sequence;
  });

  it('should receive events only from the parent in parent', async () => {
    const sequence = expectSequence(store.getEventStream(eventId), [2, 2]);
    childStore.dispatch(eventId, 1);
    store.dispatch(eventId, 2);
    childStore.dispatch(eventId, 1);
    store.dispatch(eventId, 2);
    await sequence;
  });
});
