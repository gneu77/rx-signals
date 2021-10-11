# Using rx-signals

## Using the store

### Behaviors

If you don't know what a behavior in the sense of RP is, then head back to [Terminology](https://github.com/gneu77/rx-signals/README.md#terminology).

So in _rx-signals_, a behavior is an _RxJs_-observable that always has the current value when subscribed.
In addition to this definition, there are two more things you need to know about _rx-signals_-behaviors:
1. They can be non-lazy or lazy
    1. Non-lazy behaviors are subscribed by the store itself as soon as you add them to the store. Or in _RxJs_-terminology, non-lazy behaviors are always made hot as soon as they are added to the store.
    1. Lazy behaviors will **not** be subscribed by the store. However, as soon as there are one or more subscribers, the store turns them into a hot observable.
1. They always behave as if piped with _distinctUntilChanged()_ and _shareReplay(1)_. However, internally they do **not** use _shareReplay(1)_ and thus, there is **no** risk of the memory-leaks that are possible with _shareReplay_.

#### Adding and getting behaviors

Adding a lazy behavior is done as follows:
```typescript
store.addLazyBehavior(
  identifier: TypeIdentifier<T>,
  observable: Observable<T>,
  initialValueOrValueGetter: T | (() => T) | symbol = NO_VALUE,
);
```

Adding a non-lazy behavior has the same arguments:
```typescript
store.addNonLazyBehavior(id, observable, initialValueOrValueGetter);
```

* The `identifier` is a unique symbol that you can obtain via `getIdentifier<T>(name?: string)`
* The `observable`, is the source of the behavior
  * A behavior can have only one source, so if you call `add(Non)LazyBehavior` two times with the same identifier, you will get an error on the second one (though you can remove a behavior source via `removeBehaviorSources` and then add a new source with the same identifier).
* The `initialValueOrValueGetter` is optional. It can be an inital value or a function that yields the initial value (so if the behavior is never subscribed, then the function will never be called).

No big surprise that getting a behavior just requires the identifier:
```typescript
store.getBehavior(identifier);
```

Adding and getting behaviors is type-safe, that is the type is encoded in the identifier.
When you call `getBehavior` you're not just getting a piped observable of whatever you added as behavior-source. We will see later why this is important.

Let's add some behaviors:
```typescript
WIP
```

#### Events



#### State-reducer API

