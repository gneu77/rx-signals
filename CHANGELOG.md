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
- **dispatchEvent:** dispatch an event to the store
- **addEventSource:** add an event source to the store
- **removeEventSource:** remove an event source from the store
