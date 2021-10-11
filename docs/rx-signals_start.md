# Using rx-signals

1. [Using the store]()
    1. [Type Identifiers]()
    1. [Events]()
    1. [Behaviors]()
1. [Encapsulation via Signals-type]()
1. [Reusability and Composition via SignalsFactory-type]()
1. [Testing]()

## Using the store

The _rx-signals_ store is a class to reactively manage global state and effects.
It can also be used for local state and effects management via child stores.

* With respect to [state management](https://github.com/gneu77/rx-signals/docs/rp_state_effects_start.md), the store is used
  * to define your explicit dependencies
  * to access state and derived/dependent state
* With respect to [reactivity](https://github.com/gneu77/rx-signals/docs/rp_state_effects_start.md), the store is used
  * for change propagation
  * for reactive dependency injection
* With respect to [effects management](https://github.com/gneu77/rx-signals/docs/rp_state_effects_start.md), the store
  * is the _world_ in pure function transformation
  * is the _runtime_ in effects isolation

### Type Identifiers

Type identifiers
* are used to uniquely identify a behavior or event-stream of the store
* provide type-safety for behaviors and event-streams

For a given event- or behavior-type `T`, you can (and should) obtain a new `TypeIdentifier<T>` using the function `getIdentifier<T>(name?: string)`.
The name-parameter is optional and usually not of any interest (except maybe for rare debugging-cases).
Under the hood, the returned identifier is a `symbol`. Thus, e.g. two calls of `getIdentifier<number>('MyNumber')` will return two different identifiers!

### Events

If you don't know what an event-stream in the sense of RP is, then head back to [Terminology](https://github.com/gneu77/rx-signals/README.md#terminology).

So in _rx-signals_, an event-stream is an _RxJs_-observable that has no current value, but dispatches values to subscribers at dicrete points of time. In addition to this definition, _rx-signals_-event-streams
1. always behave as hot observables piped with `share()`.
1. can have multiple sources that are subscribed by the store lazily (so only of the corresponding event-stream is subscribed)

#### Event-streams and basic event-sources

For a given `identifier`, you can get the corresponding event-stream from the store as follows:
```typescript
store.getEventStream(identifier: TypeIdentifier<T>);
```
The return value of this method is an `Observable<T>`, and if you're using TypeScript, it will infer the correct generic type for the returned observable, because it is encoded in the `identifier`.

From now on:
* the term _event-values-type_, always means the generic type of values
* the term _event-type_, means a certain `TypeIdentifier<T>`
Thus, for `const luckyNumbers = getIdentifier<number>();`, the _event-type_ would be `luckyNumbers`, while the _event-values-type_ would be `number`,

There can be multiple sources for a given _event-type_. One source that all event-streams have is a call to the dispatch function:
```typescript
store.dispatchEvent(identifier: TypeIdentifier<T>, value: T);
```

You can add further event-sources as follows:
```typescript
store.addEventSource(
  sourceIdentifier: symbol,
  eventIdentifier: TypeIdentifier<T>,
  observable: Observable<T>
);
```
* a `sourceIdentifier` is required, because it must be possible to remove event-sources from the store.
* `eventIdentifier` is your _event-type_
* `observable` can be any observable of the correct _event-values-type_ (even a behavior)
  * The store will **not** eagerly subscribe the source-observable, but only, if the corresponding event-stream is subscribed

Of course, even if all added event-sources for a given _event-type_ complete, the corresponding event-stream will **not** complete (other sources may be added in the future / `dispatchEvent` is always possible).

#### Dispatch process

There are some important **guarantees** concerning event-dispatch (whether manually or via event-sources):
* The store always dispatches events asynchronously
  * Relying on synchronous dispatch would be bad, cause it would break reactive design (remember that one purpose of RP is to [abstract away the 'When'](https://github.com/gneu77/rx-signals/docs/rp_state_effects_start.md))
* Though async, the order in which events are dispatched will always be preserved
  * So dispatching e.g. two events `A`, `B`, the `B` will be dispatched only after **all** subscribers got the `A`
  * This holds true even for the dispatch-order between parent- and child-stores (cause they're using a shared event-queue)
  * (This is one aspect that is not trivial to get right when wireing-up complex dependencies using plain _RxJs_ on your own)

Let's see this in action:
```typescript
const myEvent = getIdentifier<number>();
store.getEventStream(myEvent)
  .pipe(take(7))
  .subscribe(console.log);

store.addEventSource(
  Symbol('source1'), 
  myEvent,
  store.getEventStream(myEvent).pipe(
    filter(v => v === 3),
    mapTo(7)
  )
);
store.addEventSource(
  Symbol('source2'),
  myEvent,
  of(3, 4, 5)
);
console.log(1);
store.dispatchEvent(myEvent, 6);
console.log(2);
```

The output will be in order of the numbers:
1. `source2` adds `3`, `4` and `5` to the dispatch queue
1. `1` is logged
1. `6` is added to the dispatch queue
1. `2` is logged
1. Store dispatches `3` 
    1. `3` is logged
    1. `source1` adds `7` to the dispatch queue
1. Store dispatches `4`
...(etc)

Please have in mind that dispatching an event is always a side-effect. That means
* you should use `dispatchEvent` only to translate non-store events (like browser events) to store events
* event-sources are either effects or event-transformers (mapping from one _event-type_ to another)

#### Typed event-sources

You can also add event sources that dispatch multiple _event-types_.
E.g. a source that can dispatch 2 different _event-types_ with corresponding _event-values-types_ `A` and `B`:
```typescript
store.add2TypedEventSource(
  sourceIdentifier: symbol,
  eventIdentifierA: TypeIdentifier<A>,
  eventIdentifierB: TypeIdentifier<B>,
  observable: Observable<TypedEvent<A> | TypedEvent<B>>,
  subscribeObservableOnlyIfEventIsSubscribed?: null | TypeIdentifier<any>
)
```

As you can see, in this case, the source-observable must provide values of
```typescript
type TypedEvent<T> = Readonly<{
  type: TypeIdentifier<T>;
  event: T;
}>;
```
so that the store knows which _event-type_ to dispatch.

You might wonder about this optional parameter with the horrible name `subscribeObservableOnlyIfEventIsSubscribed`. Well, I was just not able to come up with a better name.
It is however one of the most powerful features of the store!
Think about the following scenario:
* You have an effect, hence an event-source that
  * produces the _event-types_ `myEffectSuccess` and `appError`
  * should **only** be executed, if the event produced by the effect is actually subscibed.
* You have a generic error-handler that subscribes to an _event-type_ `appError` over the whole lifetime of your application.

```typescript
store.add2TypedEventSource(
  Symbol(),
  myEffectSuccess,
  appError,
  of(
    { type: myEffectSuccess, event: mockResult },
    { type: appError, event: mockError },
  ),
  myEffectSuccess // subscribeObservableOnlyIfEventIsSubscribed
)
```

Without the last parameter, the `store.getEventStream(appError)` that you have somewhere in your global error-handler would automatically subscribe your 2-typep-event-source. Thus, the requirement that the effect should only be executed, if `myEffectSuccess` is subscribed would not be fulfilled.
However, with the last parameter, we are telling the store to subscribe the source only if `myEffectSuccess` is subscribed.

### Behaviors

If you don't know what a behavior in the sense of RP is, then head back to [Terminology](https://github.com/gneu77/rx-signals/README.md#terminology).

So in _rx-signals_, a behavior is an _RxJs_-observable that always has the current value when subscribed.
In addition to this definition, _rx-signals_-behaviors
1. can be non-lazy or lazy
    1. Non-lazy behaviors are subscribed by the store itself as soon as you add them to the store. Or in _RxJs_-terminology, non-lazy behaviors are always made hot as soon as they are added to the store.
    1. Lazy behaviors will **not** be subscribed by the store. However, as soon as there are one or more subscribers, the store turns them into a hot observable.
1. always behave as if piped with `distinctUntilChanged()` and `shareReplay(1)`. However, internally they do **not** use `shareReplay(1)` and thus, there is **no** risk of the memory-leaks that are possible with `shareReplay`.

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


#### State-Reducer API


## Encapsulation via Signals-type


## Reusability and Composition via SignalsFactory-type


## Testing