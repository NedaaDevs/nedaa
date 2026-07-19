# expo-hms-notifications

This Android-only module is Nedaa's GMS-free local-notification fork of
`expo-notifications` 57.0.3. It compiles the installed upstream Android sources after a
deterministic transform removes Firebase Cloud Messaging code. Nedaa keeps the upstream JavaScript
package and native module names, so the app's scheduling, channel, permission, and notification
response APIs remain unchanged.

Remote push tokens, topics, and background remote-notification tasks are intentionally unsupported
and reject with `E_HMS_REMOTE_NOTIFICATIONS_UNSUPPORTED`. The HMS build does not package Firebase,
Google Play services, or Google Play libraries.

When upgrading `expo-notifications`, update `upstreamVersion` in `android/build.gradle`, review the
exclusion and transform lists in `scripts/sync-upstream.mjs`, then run
`bun run verify:android:hms`. The transform fails if an expected upstream source fragment changes,
so upstream drift cannot silently restore an FCM path.

The transformed sources remain covered by Expo's MIT license in [LICENSE](LICENSE).
