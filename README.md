# _@rx-signals/store_

**Reactive state and effects management**

## Installation

`npm install --save @rx-signals/store`

## Dependencies

**_RxJs_** is the one and only peer dependency. You need a version >6.4.0 (so 7.x is also perfectly fine) in your project.

## License

[MIT](https://choosealicense.com/licenses/mit/)

## What is it?

This TS/JS library is for people who
* Need a state management
  * (If you don't like global state-management, you can still use it for local state)
* Like reactive programming and search for
  * Clean architecture
  * High-level abstractions
* Need an effects management
  * (Contrasting architectures where side-effects are implicit/hidden/polluting the call tree)
* Seek for an alternative to _NgRx_ or other _Redux_-like libs
  * (It is no problem to mix, especially interaction/integration with _NgRx_ is straight forward)

It is **not** for people who
* Don't like _RxJs_

Though it heavily relies on _RxJs_, this lib is **not** Angular-specific. You can (and should) also use it in any other context where you have _RxJs_ at your disposal!

### High-level overview
This lib comes with a
* Store-API for
  * State/Effects-management based on the RP (reactive programming) concepts of events and behaviors (generalized as signals)
  * Reactive dependency injection
* Signals-Type as
  * Encapsulation/Abstraction-layer for the composition of events and behaviors
* SignalsFactory-Type and utility functions as
  * Abstraction-layer over the Signals-Type for high-level composition and DRY architecture

## Getting started

The impatiant reader may skip the terminology part and head on to "Directions".

### Terminology

What does _rx-signals_ mean anyway?
Well the _rx_ stands for reactive extensions, so it's the same _rx_ as in _RxJs_.
The term _signals_ is lent from the world of functional reactive programming.

In FRP, there are two kinds of signals:
* Events:
  * Signals of values that occur at discrete points in time
  * So functions of time that **may or may not** yield a value
  * An event can depend on several conditions (e.g. other signals)
* Behaviors:
  * Signals of dynamic values over continuous time
  * So functions of time that alwayas yield a value
  * A behavior can depend on other behaviors and/or events

The FRP-guys may pardon me for having over-simplified a bit. If you're interested in an exact definition, [here you go](http://conal.net/papers/icfp97/).

We're however not interested in the continuous world of FRP, but instead we're working with programs that change in discrete steps, which brings us to RP. This is really confusing, because actually in RP, we're making use of functional programming a lot! It's just that the term FRP is reserved for the thing where behaviors are real functions of continous time.
Don't worry, if this is confusing or even if you still have no idea what I'm talking about. At least if you're already familiar with _RxJs_ (which is a RP-library), it's going to become much more clear next.

The FRP-definitions of events and behaviors translate to the following definitions for RP:
* Event-streams:
  * Value-streams that have no current value
  * Publish values (events) to subscribers at discrete points of time
  * Can depend on other event-streams and/or behaviors
* Behaviors:
  * Value-Streams that always have a current value (though possibly lazy)
  * Current value can change at discrete points in time
  * Can depend on other behaviors and/or event-streams

So an _RxJs_ example for behaviors would be a _BehaviorSubject_, while an example for event-streams would be _Subjects_. Thus, in _RxJs_-world you you translate _signal_ as _observable_. (Now that we arrived at _RxJs_ terminology: another difference between FRP and RP is that in RP, a signal can simply end, hence observables can complete.)

### Directions

You should start with my introduction to [Reactive Programming, State Management and Effects Management](https://github.com/gneu77/rx-signals/docs/rp_state_effects_start.md), if
* you don't know what any of these terms mean
* you think you're doing RP, just because you're using something like _RxJs_ (no, you're not)
* you think State Management is only about having a global state and how to modify it
* you think Effects Management is only about managing async processes (like http calls)

Otherwise, you may start with [Using rx-signals](https://github.com/gneu77/rx-signals/docs/rx-signals_start.md). Where necessary, it will still link to the corresponding passages of the formerly mentioned introduction.

The API-documentation as generated from the doc strings [can be found here]()

An introduction for people coming from _NgRx_ [can be found here](https://github.com/gneu77/rx-signals/docs/ngrx_compare_start.md)
