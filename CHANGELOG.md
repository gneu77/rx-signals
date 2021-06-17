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
