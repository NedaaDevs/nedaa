# Security Policy

## Supported versions

Only the current release on the App Store, Google Play, and AppGallery is supported. Fixes ship in the next release rather than as patches to older versions.

## Reporting a vulnerability

Email <support@nedaa.dev>. Please don't open a public issue for a security problem.

Include what you found, how to reproduce it, and what an attacker could do with it. If it involves a specific device or OS version, say which.

We'll acknowledge your report within a week. Nedaa is maintained by a small team, so a fix may take longer than that depending on what's involved — we'll tell you where things stand rather than leave you waiting.

Nedaa is a free app maintained by a small community, with no ads, subscriptions, or revenue behind it, so unfortunately we can't offer a bug bounty. What we can do is credit you in the release notes and in the app's acknowledgements, if you'd like that.

## What to include

The app ships no crash reporting, analytics, or telemetry of any kind, so there's no dashboard for us to check. That makes your reproduction steps the only thing we have to work from — the more specific, the better.

Nedaa keeps diagnostic logs on the device itself and uploads nothing on its own. If they're relevant, the app's "Report a problem" options can share the log file through the system share sheet, and you can attach it to your email from there.

## Scope

Worth reporting:

- Anything that exposes user data. Nedaa has no accounts and no server-side user state, so this mostly means location data or local database contents.
- Ways to make the app fetch or execute something it shouldn't.
- Problems in how downloaded content is verified or stored.
- Permission or entitlement issues on either platform.

Out of scope:

- Findings against `aladhan.com` or other third-party services. Report those to the service.
- Missing hardening that has no exploitable consequence.
- Anything requiring a rooted or jailbroken device, or physical access to an unlocked phone.
