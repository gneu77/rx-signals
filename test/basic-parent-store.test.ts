import { of } from 'rxjs';
import { Store, TypeIdentifier } from '../src/store';
import { expectSequence } from './test.utils';

describe('Parent store', () => {
  const idInParent: TypeIdentifier<number> = { symbol: Symbol('ParentBehavior') };
  const idInChild: TypeIdentifier<number> = { symbol: Symbol('ChildBehavior') };
  const idInParentAndChild: TypeIdentifier<number> = { symbol: Symbol('ParentAndChildBehavior') };

  let store: Store;
  let childStore: Store;

  beforeEach(() => {
    store = new Store();
    childStore = new Store(store);

    store.addLazyBehavior(idInParent, of(1));
    childStore.addLazyBehavior(idInChild, of(2));
    store.addLazyBehavior(idInParentAndChild, of(3));
    childStore.addLazyBehavior(idInParentAndChild, of(4));
  });

  it('should access behavior from child, if not in parent', async () => {
    await expectSequence(childStore.getBehavior(idInChild), [2]);
  });

  it('should access behavior from parent, if present there', async () => {
    await expectSequence(childStore.getBehavior(idInParent), [1]);
  });

  it('should access behavior from parent, if present in child AND parent', async () => {
    await expectSequence(childStore.getBehavior(idInParentAndChild), [3]);
  });
});
