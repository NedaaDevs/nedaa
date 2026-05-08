## fastlane documentation

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## Android

### android validate_metadata

```sh
[bundle exec] fastlane android validate_metadata
```

Validate metadata with Google Play without publishing (dry run)

### android update_metadata

```sh
[bundle exec] fastlane android update_metadata
```

Upload metadata to Google Play Store (no binary upload)

### android update_listing

```sh
[bundle exec] fastlane android update_listing
```

Upload metadata + screenshots to Google Play Store

---

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
