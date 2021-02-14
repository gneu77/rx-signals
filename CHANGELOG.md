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
