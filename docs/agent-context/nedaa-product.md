# Nedaa — Product Briefing for AI Agents

> **Purpose of this file.** This is the canonical product context for Nedaa. Agents should read this before producing marketing copy, App Store listings, website content, GEO/SEO strategy, social posts, screenshots scripts, press materials, or anything user-facing. Pair with `nedaa-technical.md` for engineering context.

---

## One-line pitch

**Nedaa is a free, open-source, privacy-first prayer-times and Islamic-companion app for iOS and Android.**

## Name & meaning

- **Nedaa** (Arabic: **نداء**) — literally "the call" or "summons." A reference to the Adhan, the call to prayer.
- Branding sometimes pairs the Latin and Arabic forms: **Nedaa | نداء**.
- Domain: `nedaa.dev`. Support: `support@nedaa.dev`.

## What the app does (end-user phrasing)

Nedaa keeps a Muslim's daily worship on track without clutter, ads, or surveillance. Core jobs-to-be-done:

- **Know when to pray** — accurate prayer times anywhere in the world, with 23 calculation methods so the user can match their local mosque.
- **Never miss Fajr** — a smart alarm with optional wake-up challenges, distinct from system notifications.
- **Get reminded the way you want** — deeply customizable notifications: per-prayer Athan sound, pre-prayer warnings, Iqama reminders.
- **See prayer times at a glance** — home-screen and lock-screen widgets, including Ramadan-specific Suhoor/Iftar widgets (iOS).
- **Build a daily Athkar habit** — morning and evening remembrances with audio recitations, plus user-created custom athkar.
- **Find the Qibla** — built-in compass with native heading sensors.
- **Check the Hijri date** — Hijri date display and a Gregorian↔Hijri converter.
- **Make up missed Ramadan fasts** — Qada tracker (fasting qada only; counts down remaining missed fasts, with a Ramadan-anchored reminder for the canonical "make up before next Ramadan" deadline, plus a privacy-mode hide).
- **Perform Umrah with confidence** — step-by-step ritual guide.
- **Keep upcoming occasions in view** — an Important Days tool: countdowns to Ramadan, both Eids, Arafah, Hijri New Year, and Ashura, with Hijri + expected Gregorian dates (moon-sighting caveat stated), plus an optional rotating Home card (off by default).
- **Read the Quran** _(in beta testing, ships at 2.10.0)_ — a mushaf reader offered in two forms: a faithful image-based mushaf (multiple editions, light/dark paper themes) and a continuous, mushaf-style **text reader** in a flowing Uthmani (Hafs) font. Includes surah/juz/hizb/page browsing, search across both surah names and verse text, colored ayah highlights, saved-place bookmarks, ayah copy/share, a **similar-verses (mutashabihat)** comparison tool for memorizers, a **reference guide** (tajweed colours, stop signs, sajda), a **Friday reminder to read Surah Al-Kahf** (the first of a growing set of Quran reading reminders, set up from the reader itself), and a first-open walkthrough. On **tablets and foldables** the reader renders as an open book: an automatic two-page spread on wide landscape screens, an ambient book-canvas backdrop instead of flat margins, and tablet-tuned page-turn motion (foldables follow the same rules as tablets). Editions and the verse data are **downloaded on demand** — nothing Quran ships in the app binary. Reciter audio ships with the reader: per-surah downloads, word-level timings for read-along, and a mini player.

## Target audience

**Primary:** Practicing Muslims who want a focused, dependable prayer-times app and resent the bloat, ads, and tracking common in the category.

**Geographic / linguistic reach:** Global. Currently shipped in **English, Arabic, Malay, and Urdu**, with full RTL support. Crowdin-based community translation pipeline (`crowdin.com/project/nedaa-v2`).

**Shipping platform reach and source targets:**

- iOS (App Store)
- Android with Google Mobile Services (Play Store)
- Android **HMS source target** — a deliberately maintained `production-hms` profile intended for Huawei devices without GMS and configured with no Google Mobile Services runtime dependencies. Release-artifact, physical no-GMS device, and AppGallery distribution validation are pending; do not market this as available support yet.

**User segments worth calling out in copy:**

- Practicing Muslims who pray on time and want their alarm/notifications to match their mosque.
- Travelers who need prayer times that follow their location automatically.
- Privacy-conscious users who refuse ad-supported or tracker-laden Islamic apps.
- Open-source advocates / developers who want a transparent codebase.
- Huawei users left out of the GMS-only ecosystem.
- Ramadan power-users who care about Suhoor/Iftar timing precision.

## Value propositions (rank-ordered)

These are the differentiators that should anchor most marketing copy:

1. **Free, no ads, no paywalls, no subscriptions, ever.** This is non-negotiable to the project's identity.
2. **Open source** — transparent in how it handles data; community-auditable.
3. **Privacy-first** — prayer-time refreshes request low-accuracy location. High accuracy is requested only during user-initiated Qibla location acquisition; the compass heading remains sensor-derived, and those coordinates are not used for analytics or tracking. There are no analytics ad networks and **no crash/telemetry SDK**. Diagnostics are written to on-device log files and never leave the phone unless the user explicitly shares them.
4. **Native, polished platform integration** — real iOS AlarmKit-backed alarms on **iOS 26+** (alarm feature requires iOS 26; gated off entirely on earlier iOS — there is no fake-alarm fallback), native foreground alarm service on Android, iOS lock-screen and home widgets, native compass sensors with sensible fallbacks, and a conditional HMS source path whose release validation is pending. Alarm types are first-class for **Fajr, Jummah, and custom**.
5. **Deep customization** — per-prayer sound, pre-prayer minutes, Iqama minutes, 23 calculation methods, custom Athan sounds the user provides.
6. **Works offline once synced** — prayer times are cached from the current month through the end of the year, so the app keeps working without internet. The cache tops itself up in the background when the system grants the app a window, and otherwise on the next open. December pulls in the following year, so the year boundary is usually invisible.
7. **Multi-language, RTL-first**.
8. **Companion features beyond prayer times** — Athkar, Umrah guide, Qada, Hijri tools, Qibla compass, and a Quran reader (in beta testing, ships at 2.10.0).

## Brand voice & tone

- **Calm, focused, un-flashy.** Nedaa is a tool that gets out of the way. Avoid hype words ("revolutionary," "game-changing"). Prefer concrete promises ("accurate," "works offline," "no ads").
- **Respectful of the subject matter.** This is a worship app. Avoid memes, edgy humor, or casual gamification framing. Streaks/tracking should be framed as habit support, not "leveling up."
- **Bilingual sensibility.** When relevant, present Arabic terminology with care: _Salah, Fajr, Dhuhr, Asr, Maghrib, Isha, Athan, Iqama, Athkar, Dhikr, Qibla, Umrah, Sa'i, Suhoor, Iftar._ Don't over-translate; assume the audience knows the vocabulary.
- **Trust-building, not selling.** "Open source" and "no ads" are stated as facts, not bragged about.
- **Short sentences, scannable bullets.** The App Store description in `fastlane/metadata/` is the canonical voice reference — match it.

## Anti-positioning ("what Nedaa is NOT")

- **Not a generic Islamic super-app.** No social feed, no donations module, no halal-restaurants directory. Focused on prayer-time excellence and adjacent habits.
- **Not ad-supported.** Never has been.
- **Not a freemium/paid tier.** No premium SKU. No "Pro" version.
- **Not data-hungry.** Doesn't ship a user account, doesn't require login, doesn't sync to a cloud profile.
- **Not aimed at non-practicing/curious users.** The audience is people who actually pray; copy can assume that baseline.
- **Calculation methods cover diverse communities; Nedaa stays neutral on madhhab/sect framing in copy.**

## Privacy & data stance

- Prayer-time refreshes request **low-accuracy** location. High accuracy is requested only while the user initiates Qibla location acquisition to calculate the bearing; compass heading remains sensor-derived. These coordinates are not used for analytics or tracking.
- No third-party advertising or tracking SDKs.
- **No crash/telemetry SDK** (Sentry was removed 2026-06). Diagnostics are on-device log files only (per-domain, 30-day + 5 MB retention, local JS crash capture); nothing is uploaded — the user shares logs manually when reporting a problem. Marketing can lead with **"no telemetry, ever — diagnostics never leave your device."**
- No user account, no cloud sync.
- Open source — anyone can verify the above.

## Distribution & channels

- **App Store** (iOS): bundle id `dev.nedaa.app`.
- **Google Play** (Android, GMS): package `dev.nedaa.android`.
- **HMS/AppGallery release target** (not yet validated or advertised as available): same package, separate `production-hms` source profile. Release-artifact, physical no-GMS device, and distribution validation are pending.
- **Source:** GitHub `NedaaDevs/nedaa`.
- **Translation:** Crowdin `nedaa-v2`.
- **Support email:** `support@nedaa.dev`.
- **Website:** `nedaa.dev`.
- **CDN:** `cdn.nedaa.dev` — hosts athkar audio and Quran assets.

## Canonical App Store copy

The English and Arabic App Store descriptions in `fastlane/metadata/` are the authoritative voice. New marketing copy should align with those. Excerpts:

> "Accurate prayer times with beautiful widgets, smart alarms, and daily Athkar — completely free, no ads, and open source."

> "Nedaa (meaning 'calling' in Arabic) is your focused companion for every salah."

## Named upstream data sources (use in marketing, GEO, and credit copy)

Nedaa builds on respected, named Islamic-data projects. These are entities AI engines and search engines already trust — citing them transparently both meets license obligations _and_ strengthens GEO/SEO authority signals.

- **Aladhan API** (`aladhan.com`, by Islamic Network) — **currently the only implemented** upstream prayer-time provider. The architecture is **provider-abstracted at the API layer** (see `src/types/providerSettings.ts` `ProviderName` / `PRAYER_TIME_PROVIDERS` and the separate `api/` repo where provider integration lives), so additional providers can be added without app updates. All 23 calculation methods Nedaa exposes today come from Aladhan. **Marketing copy should not say "Nedaa uses the Aladhan API" as if it's a hard dependency** — the truthful framing is "provider-abstracted; Aladhan is the currently-implemented upstream."
- **Hisn al-Muslim** — the source dataset for athkar (morning/evening remembrances, occasion-based duas), compiled by Sa'id ibn Ali ibn Wahaf al-Qahtani.
- **Tanzil.net (Tanzil Project)** — Quran text in Uthmani script, CC-BY 3.0. Attribution to "Tanzil Project" with a link to `tanzil.net` is **required** by license and is shown in the app's About screen.
- **QuranicAudio and quran.com** — the source of the recitation audio Nedaa mirrors and serves from its own CDN.
- **Quranic Universal Library (QUL) by Tarteel AI** — Quran metadata and word-timing.
- **QCF (King Fahd Quran Complex) font** — page-image and font basis for the mushaf reader.
- **Unwan frames** — traditional Islamic typography research informing the reader's chrome.

When writing marketing or GEO content for the Quran or Athkar features, **name these sources explicitly**. They are search-relevant entities and they signal data provenance and license-compliance, both of which help recommendation surfaces.

## Visual identity (high level)

- Light and dark variants of the app icon ship together; iOS uses adaptive light/dark.
- Typography: **Asap** for Latin scripts, **IBM Plex Sans Arabic** for Arabic. Locale-aware font swap is built in.
- Theming via Tamagui design tokens; the app supports multiple user-selectable themes plus system light/dark.

## Keyword bag (for App Store, GEO, SEO)

From shipped App Store metadata:

`adhan, hajj, muslim, qibla, ramadan, dua, hijri, islamic, widget, mosque, umrah, reminder, iftar, suhoor, dhikr`

Arabic: `دعاء, رمضان, سحور, إفطار, قبلة, هجري, مسجد, إسلامي, ويدجت, قضاء, تسبيح, حج, إقامة, مؤذن, صوم, تذكير, أوقات, تقويم, ذكر`

## Recurring marketing themes by season

- **Ramadan** — Suhoor/Iftar widgets, accurate Imsak, increased Athkar emphasis, Fajr alarm reliability.
- **Hajj/Umrah season** — Umrah step-by-step guide, Qibla, Hijri date.
- **Back-to-routine periods (post-Ramadan, start of Hijri year)** — habit framing, Athkar streaks, reliable Fajr.

## When generating content, prefer:

- Concrete features over abstract benefits ("Lock-screen widget with countdown" > "Stay connected to your prayers").
- Native platform terms users recognize ("home-screen widget," "lock-screen widget," "Live Activity") when accurate.
- Terms users actually search for ("Athan," "Qibla," "Hijri date," "prayer times near me," "Fajr alarm").
- Quoting the project's own values ("free, no ads, open source") rather than competitor comparisons by name.

## When generating content, avoid:

- Implying premium tiers or in-app purchases.
- Promising features that aren't shipped yet (check `nedaa-technical.md` capability map for the current feature set).
- Speaking on behalf of religious authorities or claiming endorsement.
