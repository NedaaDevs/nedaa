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

## Table of Contents

- [Table of Contents](#table-of-contents)
- [Introduction](#introduction)
- [Features](#features)
- [Acknowledgements](#acknowledgements)
- [Feedback](#feedback)
- [Translation](#translation)
  - [Developer Guide](#developer-guide)

## Introduction

<!-- ![CI Status](https://github.com/nedaaDevs/nedaa/actions/workflows/flutter-ci.yml/badge.svg) -->

View Prayer Times, Hijri Date, get notifications for prayer times, and more to come.

**Available for both iOS and Android.**

<!-- <p align="center">
  <img alt="iphone-preview" src="https://i.imgur.com/r2lgNUo.png"  width=350>
  <img alt="oneplus-preview" src="https://i.imgur.com/WGWpycM.png" width=350>
</p> -->

## Features

Nedaa Features:

- Simple and intuitive design.
- Notifications for each prayer, iqama and pre-prayer.
- Deep customization for the notifications settings, with the ability to enable/disable, and change the sound, and timing of the iqama, and pre-prayer, along with other settings.
- Multi-language support Arabic and English. [Want to see the app in your language? ](#translation)
- Finding the location automatically using the phone’s GPS. Or manually.
- Count down to the next prayer.
- Count up since the last prayer.
- Prayer times for the current day.
- and more to come.

<!-- <p align="center">
  <img src="https://i.imgur.com/VoCxMoo.png" height=350>
  <img src="https://i.imgur.com/YtOMaFQ.png" height=350>
  <img src="https://i.imgur.com/bA3FdZd.png" height=350>
  <img src="https://i.imgur.com/XMvcdJr.png" height=350>
  <img src="https://i.imgur.com/QlyrIHk.png" height=350>
</p>

<p align="center">
 <img src="https://i.imgur.com/C3iLTaw.png" width=400 >
 <img src="https://i.imgur.com/mdC2OX8.png"  width=400>
 <img src="https://i.imgur.com/dycQy7M.png" width=400>
 <img src="https://i.imgur.com/njUoebp.png"  width=400>
 <img src="https://i.imgur.com/Pt36AGI.png"  width=400>
</p> -->

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

- Push to `master` and Crowdin auto-uploads new English source strings for translation.
- Crowdin keeps a single PR open from its `l10n_master` branch. Merge it into `master` before each release (merge, don't delete the branch — Crowdin reuses it). Letting it sit lets the branch drift behind `master`.

A locale only becomes selectable when it's listed in `AppLocale` (`src/enums/app.ts`) — both the language picker and the device-default resolver derive from that enum. Keep a locale gated there until its Crowdin coverage is ship-ready.

### Developer Guide

Please refer to the [Developer Guide](./docs/DEV-README.md).
