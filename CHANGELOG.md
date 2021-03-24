# 2.1.0-rc.1 (2020-03-24)

# 2.0.2-rc.1 (2020-03-22)

### Breaking changes

- **renamed addStatelessBehavior to addLazyBehavior**
- **renamed addStatefulBehavior to addNonLazyBehavior**
- **renamed removeBehavior to removeBehaviorSources with optional flag to complete subscribers (should not be used)**
- **removed some obsolete debug methods**

### Changes

- **added method getIsSubscribedObservable to store**

### Fixes

- **target subjects are no longer completed, if a source completes**

### Changes

- **x-TypedEventSources can now have sources that are subscribed conditionally only if another event is subscribed**

# 2.0.1-rc.2 (2021-03-16)

### Changes

- **replaced shareReplay(1) by memory-safe variant**
- **pre-subscribe for lazy behaviors to hand-out only most recent values**

# 2.0.1-rc.1 (2021-03-10)

### Fixes

- **removing all sources when removing a behavior (relevant in case of multiple reducers with the new state/reducer API)**

# 2.0.0-rc.1 (2021-03-09)

### Breaking changes

- **With versions 1.x, events were dispatched synchronously, but now they are dispatched asynchronously. The reason is, that in case of synchronous events you could end up in a wrong state, if an effect subscribing a stateful behavior, was dispatching an event that again the behavior was listening to (so a reduce triggered by another reduce, which leads to behavior observers getting the result of the second reduce before getting the result of the first reduce). The solution was to delay the events in the behavior observable, but of course, this is something being easily forgotten or overlooked by developers, so now this source of error is eliminated by the store. In consequence, you no longer can rely on changes being synchronously available after dispatch, but in fact, you never should have done so, because this would mean you have broken reactivity. There is however a way to help in such a scenario: dispatchEvent now returns a Promise\<boolean\> that gets resolved after the async dispatch has been finished. It resolves to true in case the event had been subscribed, else to false. A common use case for awaiting this Promise would be in unit tests.**

### Features

- **added methods addState, addReducer and removeReducer: these are convenience methods that simplify the definition of stateful behaviors. In contrast to directly using addStatefulBehavior, you can now add and/or remove reducers individually. The only way to do this in earlier versions would have been to remove and add the complete behavior each time you were changing the set of its reducers.**

# 1.1.0-rc.3 (2021-02-15)

### Features

- **added methods add4TypedEventSource, add5TypedEventSource, add6TypedEventSource**

# 1.1.0-rc.2 (2021-02-15)

### Fixes

- **share source code for add2TypedEventSource and add3TypedEventSource**

# 1.1.0-rc.1 (2021-02-14)

### Features

- **added two new methods to add typed event sources for two or three different events: add2TypedEventSource, add3TypedEventSource**

# 1.0.0-rc.4 (2020-10-25)

### Fixes

- **simplified check for cyclic subscription**

# 1.0.0-rc.3 (2020-10-23)

### Fixes

- **only subscribe sources, if not-cyclic subscriber exists**

# 1.0.0-rc.2 (2020-10-22)

- **some cleanup work**

### Features

- **getTypedEventStream:** get observable for events of given type, bundled with the type (handy for reducers)
- **resetBehaviors** reset all behaviors of the store

# 1.0.0-rc.1 (2020-10-20)

- **first release candidate**

# 1.0.0-beta.10 (2020-10-20)

### Fixes

- **fixed packaging**

# 1.0.0-beta.9 (2020-10-20)

### Breaking changes

- **it is now possible to add multiple event sources for the same event type**

# 1.0.0-beta.8 (2020-10-15)

### Features

- **now providing commonjs and es modules**

# 1.0.0-beta.7 (2020-10-15)

### Fixes

- **initial value for stateful behavior is no dispatched lazily**

# 1.0.0-beta.6 (2020-10-15)

### Fixes

- **initial value must be added with source and not upon subject creation**

### Features

- **getUnsubscribedIdentifiers:** returns an array with identifier symbols of unsubscribed sources and behaviors (for debugging purposes)
- **getNoSourceBehaviorIdentifiers:** return an array of behaviors that were requested from the store but have no source (for debugging too)

# 1.0.0-beta.5 (2020-10-15)

### Breaking changes

- **changed lib target to es2016**

### Features

- **addBehavior:** as lower level API for addStatelessBehavior and addStatefulBehavior (has a subscribeLazy parameter)
- **isAdded:** return true, if a corresponding behavior or event source has been added
- **isSubscribed:** return true, if a corresponding behavior or event has been subscribed

# 1.0.0-beta.4 (2020-10-14)

### Fixes

- **fixed possible subscription loop (for circular dependencies)**

# 1.0.0-beta.3 (2020-10-14)

### Breaking changes

- **replaced addBehavior by addStatelessBehavior and addStatefulBehavior:** This explicit distinction makes also determines if the source will be subscribed lazily (for stateless) or not.

# 1.0.0-beta.2 (2020-10-13)

### Fixes

- **make sure unsubscribed behaviors get a current value**

# 1.0.0-beta.1 (2020-10-07)

### Features

- **addBehavior:** add a behavior to the store
- **removeBehavior:** remove a behavior from the store
- **getBehavior:** get a behavior observable from the store
- **getEventStream:** get observable for events of given type
- **dispatchEvent:** dispatch an event to the store
- **addEventSource:** add an event source to the store
- **removeEventSource:** remove an event source from the store
