import { NEVER } from 'rxjs';
import { take } from 'rxjs/operators';
import { TypeIdentifier } from '../src/store.utils';
import { Store } from './../src/store';
describe('use the store for dependency injection', () => {
  interface IMyService {
    execute: (callback: () => any) => void;
  }
  const IMyServiceIdentifier: TypeIdentifier<IMyService> = {
    symbol: Symbol('IMyServiceIdentifier'),
  };

  let constructed = 0;
  const concreteServiceConstructor = () => {
    constructed = constructed + 1;
    return {
      execute: (callback: () => any) => callback(),
    };
  };

  let store: Store;

  beforeEach(() => {
    store = new Store();
    constructed = 0;
  });

  describe('lazy injection', () => {
    it('should instantiate the service lazily', done => {
      store.addLazyBehavior(IMyServiceIdentifier, NEVER, () => concreteServiceConstructor());
      expect(constructed).toBe(0);
      const servicePipe = store.getBehavior(IMyServiceIdentifier).pipe(take(1));
      expect(constructed).toBe(0);
      servicePipe.subscribe(myService => {
        expect(constructed).toBe(1);
        myService.execute(done);
      });
    });

    it('should provide the service, when it becomes available', done => {
      store
        .getBehavior(IMyServiceIdentifier)
        .pipe(take(1))
        .subscribe(myService => {
          myService.execute(done);
        });

      store.addLazyBehavior(IMyServiceIdentifier, NEVER, () => concreteServiceConstructor());
    });

    it('should instantiate the injected service only once', done => {
      const servicePipe = store.getBehavior(IMyServiceIdentifier).pipe(take(1));
      store.addLazyBehavior(IMyServiceIdentifier, NEVER, () => concreteServiceConstructor());
      servicePipe.subscribe(myService => {
        expect(constructed).toBe(1);
        myService.execute(() => {
          setTimeout(() => {
            servicePipe.subscribe(myService2 => {
              expect(constructed).toBe(1);
              myService2.execute(done);
            });
          }, 0);
        });
      });
    });

    it('should re-instantiate the injected service upon store reset', done => {
      const servicePipe = store.getBehavior(IMyServiceIdentifier).pipe(take(1));
      store.addLazyBehavior(IMyServiceIdentifier, NEVER, () => concreteServiceConstructor());
      servicePipe.subscribe(myService => {
        expect(constructed).toBe(1);
        store.resetBehaviors();
        myService.execute(() => {
          setTimeout(() => {
            servicePipe.subscribe(myService2 => {
              expect(constructed).toBe(2);
              myService2.execute(done);
            });
          }, 0);
        });
      });
    });
  });
});
