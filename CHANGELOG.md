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
