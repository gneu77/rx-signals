# _@rx-signals/store_

**Reactive state and effects management**

:warning: This documentation is work in progress for the upcoming 3.0.0 version.
There is however NO good reason to use 2.x over 3.0.0-rc40, so please start with the rc-version (3.0.0 will be the first version I'm going to advertise publicly, so it's more like a 1.0 in reality.).
2.x is deprecated and will NOT be maintained in any way.

It's mainly documentation that needs improvement prior to the final 3.0.0 realease.
It is however possible that I will introduce minor breaking changes until 3.0.0 is finally released.

## Installation

**`npm install --save @rx-signals/store@3.0.0-rc40`**

## Dependencies

**_RxJs_** is the one and only dependency.

## License

[MIT](https://choosealicense.com/licenses/mit/)

## What is it?

_rx-signals_ is a library for the MVU (**M**odel-**V**iew-**U**pdate) pattern.

It is however not limited to MVU, but can be used in all architectures that would benefit from its features:
* Immutable State Management
  * Global and/or local
* Reactive Programming
  * High-level abstractions over _RxJs_ (you can still go as low as you want)
* Effects Management
  * Clean side-effect isolation
  * Mock-less testing of your application logic
* An alternative to _Redux_, _NgRx_ or other MVU-libs
  * Less boilerplate / More DRY
  * More abstractions / Better reusability

Though it heavily relies on _RxJs_, this lib is **not** Angular-specific. You can (and should) also use it in any other context where you have _RxJs_ at your disposal!

(Use it in the backend or with any presentation-framework you like. Decoupling application-logic from presentation-logic is a strength of this library.)

_rx-signals_ itself is implemented with TypeScript and therefore naturally comes with **first-class type-safety**.

### High-level overview
This lib comes with a
* Store for
  * State-management based on the RP (reactive programming) concepts of events and behaviors (generalized as signals)
  * Reactive dependency injection
* Signals- and SignalsBuilder Types as
  * Encapsulation/Abstraction-layer over low-level signal-composition
* SignalsFactory as
  * Abstraction-layer over the SignalsBuilder-type for high-level composition and reusability (enabling DRY architecture)
* EffectSignalsFactory as
  * SignalsFactory that covers side-effect-scenarios generically, encapsulating and abstracting away all the pitfalls and possibilities to shoot yourself in the foot.
* Full type-safety everywhere

See [**_rx-signals_ design goals**](https://github.com/gneu77/rx-signals/blob/master/docs/rx-signals_start.md#design) for more.

## Getting started

### Terminology <a name="terminology"></a>

What does _rx-signals_ mean anyway?
Well the _rx_ stands for reactive extensions, so it's the same _rx_ as in _RxJs_, giving tribute to this congenial lib that is the base of _rx-signals_.
The term _signals_ is lent from the world of functional reactive programming (FRP), that knows two types of signals.
The first type are _Events_ being a signal of values occurring at discrete points of time.
The second type of _signals_ are _Behaviors_ that represent values that vary over time in response to _Events_.

In RP (Reactive Programming), we can define _Events_ and _Behaviors_ as follows:<a name="rp-signals-definition"></a>
* Event-streams:
  * Value-streams that have no current value
  * Publish values (events) to subscribers at discrete points of time
  * Can depend on other event-streams and/or behaviors
* Behaviors:
  * Value-Streams that always have a current value (though possibly lazy)
  * Current value can change at discrete points in time (published to subscribers)
  * Can depend on other behaviors and/or event-streams

So an _RxJs_ example for behaviors would be a _BehaviorSubject_, while an example for event-streams would be a _Subject_.
Thus, in _RxJs_-world you can translate _signal_ as _observable_.

### Directions <a name="directions"></a>

You should start with my introduction to [MVU, State Management, Reactive Programming and Effects Management](https://github.com/gneu77/rx-signals/blob/master/docs/rp_state_effects_start.md), if
* you don't know what any of these terms mean
* you like to understand the basis for the _rx-signals_ architecture
* you think State Management is only about having a global state and how to modify it
* you think you're doing RP, just because you're using something like _RxJs_
* you think Effects Management is only about managing async processes (like http calls)
* you don't know that all these things are tied together

Otherwise, you may start with [**Using _rx-signals_**](https://github.com/gneu77/rx-signals/blob/master/docs/rx-signals_start.md). 
Where necessary, it will still link to the corresponding passages of the formerly mentioned introduction.

The full API-documentation (as generated from the doc strings) [can be found here](https://rawcdn.githack.com/gneu77/rx-signals/master/docs/tsdoc/index.html)

If you want to use this library in an Angular project, I suggest using the [@rx-signals/angular-provider](https://github.com/gneu77/rx-signals-angular-provider/tree/master/projects/rx-signals/angular-provider) in addition.

An introduction for people with _NgRx_ background [can be found here](https://github.com/gneu77/rx-signals/blob/master/docs/ngrx_compare_start.md)
