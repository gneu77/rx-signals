# _@rx-signals/store_

**Reactive state and effects management**

:warning: This documentation is work in progress for the upcoming 3.0.0 version.
There is however no good reason to use 2.7 over 3.0.0-rc2, so please start with the rc-version.

3.0.0-rc2 is better than 2.7 in any aspect and the code is production-ready.
The only drawback is that minor breaking changes are still possible until 3.0.0 is released.

## Installation

`npm install --save @rx-signals/store@3.0.0-rc2`

## Dependencies

**_RxJs_** is the one and only peer dependency. You need a version >6.4.0 (so 7.x is also perfectly fine) in your project.

## License

[MIT](https://choosealicense.com/licenses/mit/)

## What is it?

_rx-signals_ is a library for the MVU (**M**odel-**V**iew-**U**pdate) pattern.

It is however not limited to MVU, but can be used in all architectures that would benefit from its features:
* State Management
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

_rx-signals_ itself is implemented with TypeScript and therefore naturally comes **fully typed** (in case you're using it with TS).

### High-level overview
This lib comes with a
* Store for
  * State-management based on the RP (reactive programming) concepts of events and behaviors (generalized as signals)
  * Reactive dependency injection
* Signals- and SignalsBuilder Types as
  * Encapsulation/Abstraction-layer over low-level signal-composition
* SignalsFactory as
  * Abstraction-layer over the SignalsBuilder-Type for high-level composition and reusability (enabling DRY architecture)
* EffectSignalsFactory as
  * SignalsFactory that covers all side-effect-scenarios generically, encapsulating and abstracting away all the pitfalls and possibilities to shoot yourself in the foot.

## Getting started

The impatient reader may skip the terminology part and head on to [Directions](#directions).

### Terminology <a name="terminology"></a>

What does _rx-signals_ mean anyway?
Well the _rx_ stands for reactive extensions, so it's the same _rx_ as in _RxJs_.
The term _signals_ is lent from the world of functional reactive programming (FRP), though _rx-signals_ features reactive programming (RP).
You can [skip to the definition of _signals_ in RP](#rp-signals-definition), if you're not really interested in the actual difference between FRP and RP:

In **FRP**, there are two kinds of signals:
* Events:
  * Signals of values that occur at discrete points in time
  * So functions of time that **may or may not** yield a value
  * An event can depend on several conditions (e.g. other signals)
* Behaviors:
  * Signals of dynamic values over continuous time
  * So functions of time that alwayas yield a value
  * A behavior can depend on other behaviors and/or events

The FRP-guys may pardon me for having over-simplified a bit. 
If you're interested in an exact definition, [here you can start](http://conal.net/papers/icfp97/) (though the above definition better resembles RT-FRP, so the original paper is really just a start).

We're however not interested in the continuous world of FRP, but instead we're working with programs that change in discrete steps, which brings us to RP (in RP the signals are not functions of time, but only of ordered signals they depend on).
This is really confusing, because actually in RP, we're making use of functional programming **a lot**! 
It's just that the term FRP is reserved for the thing where behaviors are real functions of continous time.
Don't worry, if this is confusing or even if you still have no idea what I'm talking about. 
At least if you're already familiar with _RxJs_ (which is a RP-library), it's going to become much more clear next.

The FRP-definitions of events and behaviors translate to the following definitions for **RP**:<a name="rp-signals-definition"></a>
* Event-streams:
  * Value-streams that have no current value
  * Publish values (events) to subscribers at discrete points of time
  * Can depend on other event-streams and/or behaviors
* Behaviors:
  * Value-Streams that always have a current value (though possibly lazy)
  * Current value can change at discrete points in time (published to subscribers)
  * Can depend on other behaviors and/or event-streams

So an _RxJs_ example for behaviors would be a _BehaviorSubject_, while an example for event-streams would be _Subjects_.
Thus, in _RxJs_-world you can translate _signal_ as _observable_. (Now that we arrived at _RxJs_ terminology: another difference between FRP and RP is that in RP, a signal can simply end, hence observables can complete.)

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

The API-documentation (as generated from the doc strings) [can be found here](https://rawcdn.githack.com/gneu77/rx-signals/master/docs/tsdoc/index.html)

An introduction for people with _NgRx_ background [can be found here](https://github.com/gneu77/rx-signals/blob/master/docs/ngrx_compare_start.md)
