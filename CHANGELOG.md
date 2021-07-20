# 2.6.0 (2021-07)

### Fixes

- Fixed a bug for x-typed event sources with subscribeObservableOnlyIfEventIsSubscribed parameter: It was possible that the source was not already switched for one of the sources, when an event was already dispatched after the subscribeObservableOnlyIfEventIsSubscribed event was subscribed.
- Removed all usage of shareReplay, because even with refCount, a case was encountered where shareReplay lead to a memory leak.

### Improvements

- Generalized and simplified the signal factories API. The factories now compose naturally via bind (aka flatMap). The the validated-input-with-result-factory for an (admittedly complex) example.
- Changed concept for usage of parent-child stores (yes, a breaking change in a minor version, but this was not yet used by anyone). Child stores must now be created via corresponding method on the parent. Child store behaviors now always use child sources, if available, else fall back on the parent.

# 2.5.5 (2021-07-08)

### Features

- Expose parent store.

# 2.5.4 (2021-07-07)

### Features

- The store constructor now takes a parent store as optional parameter. If a behavior is requested from a store and it has a parent store with that behavior, than the request will be delegated to the parent. This means, all required parent behaviors should be added before being requested from a child, to avoid unexpected results. Also event sources are not delegated.

# 2.5.3 (2021-07-01)

### Improvements

- Added also the exported low-level-type-symbols to index.ts, to help Typescript recognizing matching types

# 2.5.2 (2021-06-30)

### Features

- Signals factories now expose their internal effect result events. Subscribing to the corresponding event streams will NOT subscribe the behaviors and thus, no effects will be triggered by simply subscribing to the streams.

# 2.5.1 (2021-06-30)

### Features

- All signals factories will now pass input and result of previous calls as additional optional arguments to effects.

# 2.5.0 (2021-06-30)

### Features

- **prepareInputWithResultSignals** and **prepareValidatedInputWithResultSignals**: Added new option **withTriggerEvent**. If set true, the result effect will only be triggered, when the corresponding event is dispatched (the event is just an alias for the invalidation event).
- All signals factories now provide an event stream for unhandled effect errors. Subscribing to these streams will NOT subscribe the behaviors (thus, you can always subscribe with your generic error handler without triggering the effects unless you subscribe the behaviors of these factories).

# 2.4.2 (2021-06-28)

### Fixes

- **prepareValidatedInputWithResultSignals** a custom input equals function will now also be used on the validated input (preventing a retriggered result effect upon changed input)

# 2.4.1 (2021-06-25)

### Fixes

- Fixed module exports, to make everything available under @rx-signals/store

# 2.4.0 (2021-06-24)

### Features

- **prepareValidatedInputSignals** Get a factory for signals representing a validated input.
- **prepareInputWithResultSignals** Get a factory for signals representing a result for an input and result invalidation.
- **prepareValidatedInputWithResultSignals** Get a factory for signals representing a result for a validated input.

# 2.3.0 (2021-06-17)

### Features

**First store utility functions** This minor version brings the first utility functions to help reducing boilerplate code for standard patterns.
- **getIdentifier** A simple convenience function to create store type identifiers.
- **prepareEffectSignals** A facory function that generalizes all the store setup for the case where you have an input model, an effect taking the input and producing a result model, as well as providing loading behavior and invalidation (refresh) event.

# 2.2.3 (2021-05-05)

### Fixes

- Up to 2.2.2, the order in which events were dispatched was guaranteed only for events of the same type. Hence, in case of synchronously dispatched events A1, A2, B1, A3, B2, it was guaranteed that A2 is always received after A1, but it was not guaranteed that B1 always directly follows A2 dispatch (e.g. A1, A2, A3, B1, B2 was possible). From 2.2.3 on, there is a store-wide event queue that guarantees observers to receive events exactly in dispatch order.

# 2.2.2 (2021-04-03)

### Dependencies

- **Made rxjs a peer dependency (was a dependency before) and relaxed the version requirement to ^6.4.0 (though there should be no reason not to upgrade your project to the latest 6.x version)**

# 2.2.0 (2021-04-01)

### Features

- **Instead of passing an initial value, all corresponding methods now also accept a callback providing the initial value.** This is especially useful for lazy behaviors, as you can now also perform the initial value creation lazily (of course you could already do this before, by not using initialValue, but instead piping your behavior observable with a startWith(initialValue)).

### Documentation

- **Finally added at least some doc strings for the store API**

# 2.1.1 (2021-03-26)

### Fixes

- No longer passing undefined as initial value to SourceObservable, but the semantically more correct NO_VALUE (This was not really a bug, cause passing undefined or NO_VALUE currently made no difference at runtime. However, it might have lead to a bug in the future, when modifying SourceObservable without having this in mind.)

# 2.1.0 (2021-03-25)

- **This is the first official (non-RC) release** (though documentation is still missing)
- See the git history of CHANGELOG.md, if you're interested in the changes for all the previous RC versions
