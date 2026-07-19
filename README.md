[![Crowdin](https://badges.crowdin.net/nedaa-v2/localized.svg)](https://crowdin.com/project/nedaa-v2)
[![Code Quality Checks](https://github.com/NedaaDevs/nedaa/actions/workflows/code-quality.yml/badge.svg)](https://github.com/NedaaDevs/nedaa/actions/workflows/code-quality.yml)
[![Build Android](https://github.com/NedaaDevs/nedaa/actions/workflows/build-android.yml/badge.svg?branch=master)](https://github.com/NedaaDevs/nedaa/actions/workflows/build-android.yml)

<h1 align="center"> Nedaa | نداء </h1> <br>

<p align="center">
  <a href="https://nedaa.dev" target="_blank">
   <picture>
      <source media="(prefers-color-scheme: dark)" srcset="./assets/images/ios-dark.png">
      <source media="(prefers-color-scheme: light)" srcset="./assets/images/ios-light.png">
      <img alt="Nedaa" title="Nedaa" src="./assets/images/ios-dark.png" width="200">
   </picture>
  </a>
</p>

<p align="center">
  Prayer times, Athkar, Qibla, and reliable alarms for iOS and Android.<br/>
  Free, no ads, no tracking, no accounts.
</p>

<p align="center">
  <a href="https://apps.apple.com/app/id6740703900">App Store</a>
  &nbsp;·&nbsp;
  <a href="https://play.google.com/store/apps/details?id=dev.nedaa.android">Google Play</a>
  &nbsp;·&nbsp;
  <a href="https://appgallery.huawei.com/app/C114573733">AppGallery</a>
  &nbsp;·&nbsp;
  <a href="https://nedaa.dev">nedaa.dev</a>
</p>

<p align="center">
  <img src="./assets/images/readme/prayer-times.png" width="250">
  <img src="./assets/images/readme/athkar.png" width="250">
  <img src="./assets/images/readme/qibla.png" width="250">
</p>

## What it does

Nedaa tells you when to pray, wherever you are, and reminds you the way you want to be reminded. It's free, with no ads and no tracking, and there's no account to make.

Available for iOS and Android, including Huawei devices without Google services.

## Features

- Prayer times anywhere in the world, with 23 calculation methods so you can match your local mosque.
- Notifications for each prayer, with your own Athan sound, pre-prayer warnings, and Iqama reminders. All of it is set per prayer.
- A Fajr alarm that behaves like a real alarm instead of a notification, with an optional wake-up challenge.
- Home screen and lock screen widgets, including Suhoor and Iftar widgets during Ramadan.
- Morning and evening Athkar with audio, and you can add your own.
- Qibla compass.
- Hijri date, and a Hijri to Gregorian converter.
- Qada tracker for missed Ramadan fasts.
- A step-by-step Umrah guide.
- Countdowns to Ramadan, both Eids, Arafah, Ashura, and the Hijri new year.
- Arabic, English, Malay, and Urdu, with full RTL. [Want to see the app in your language?](#translation)
- Works offline once your prayer times are synced.

A Mushaf reader with recitation audio is in beta testing and ships soon.

## Built with

Expo and React Native, TypeScript, Tamagui for the UI, Zustand for state, and SQLite for local storage. The alarms, compass, and widgets are native modules under `modules/`.

Setup instructions are in the [Developer Guide](./docs/DEV-README.md).

## Acknowledgements

Nedaa is built on the generous work of others:

**Qur'an**

- **Qur'an text** — [Tanzil.net](https://tanzil.net).
- **Mushaf layout & font** — [King Fahd Glorious Qur'an Printing Complex (KFGQPC)](https://qurancomplex.gov.sa) — UthmanicHafs font and page layout.
- **Verse metadata & recitation timing** — [Qur'anic Universal Library (QUL)](https://qul.tarteel.ai) by Tarteel.
- **Recitation** — recitation audio from [QuranicAudio](https://quranicaudio.com) and [quran.com](https://quran.com), mirrored via QUL.

**Fonts**

- [IBM Plex Sans Arabic](https://github.com/IBM/plex) — SIL Open Font License 1.1.
- [Asap](https://fonts.google.com/specimen/Asap) — SIL Open Font License 1.1.

**Tools**

- [Crowdin](https://crowdin.com) — free access to their localization platform through their open source program.

## Feedback

If there is a feature you would like to see in the app, please let us know <a target="_blank" href="mailto: support@nedaa.dev">support@nedaa.dev</a>. We are always looking for ways to improve the app.
Also pull request are welcome.
<br/>
If you find any issue please [file an issue](https://github.com/nedaaDevs/nedaa/issues/new).

If you have any questions, feel free to reach us at <a target="_blank" href="mailto: support@nedaa.dev">support@nedaa.dev</a>

## Translation

If you would like to see the app in your language, you can contribute very easily by joining our [crowdin project](https://crowdin.com/project/nedaa-v2/invite?h=ab811dde9acfea7c0086a694e94f75ca2468850).

Select the language you want, and submit translations to the strings in the app.

If you don't see your language in the crowdin project, you can create a new ["discussion"](https://crowdin.com/project/nedaa-v2/discussions) in the crowdin project, and we will add the language for you.

### Maintaining translations

`en.json` is the source of truth and the only file developers edit by hand (Arabic, `ar.json`, is also hand-maintained by the team). The remaining locales are owned by Crowdin — never edit those files directly, they are overwritten on the next download.

The flow:

- Once new English strings land on `master`, Crowdin picks them up for translation on its own.
- Crowdin keeps a single PR open from its `l10n_master` branch. Merge it into `master` before each release (merge, don't delete the branch — Crowdin reuses it). Letting it sit lets the branch drift behind `master`.

A locale only becomes selectable when it's listed in `AppLocale` (`src/enums/app.ts`) — both the language picker and the device-default resolver derive from that enum. Keep a locale gated there until its Crowdin coverage is ship-ready.
