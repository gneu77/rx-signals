# 2.1.1 (2021-03-26)

### Fixes

- no longer passing undefined as initial value to SourceObservable, but the semantically more correct NO_VALUE (This was not really a bug, cause passing undefined or NO_VALUE currently made no difference at runtime. However, it might have lead to a bug in the future, when modifying SourceObservable without having this in mind.)

# 2.1.0 (2021-03-25)

- **This is the first official (non-RC) release** (though documentation is still missing)
- See the git history of CHANGELOG.md, if you're interested in the changes for all the previous RC versions
