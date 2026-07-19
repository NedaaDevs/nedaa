import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const [upstreamRoot, outputRoot] = process.argv.slice(2);

if (!upstreamRoot || !outputRoot) {
  throw new Error("Usage: sync-upstream.mjs <upstream-java-dir> <generated-java-dir>");
}

const excluded = new Set([
  "expo/modules/notifications/NotificationsPackage.kt",
  "expo/modules/notifications/notifications/RemoteMessageSerializer.java",
  "expo/modules/notifications/notifications/background/BackgroundRemoteNotificationTaskConsumer.kt",
  "expo/modules/notifications/notifications/background/ExpoBackgroundNotificationTasksModule.kt",
  "expo/modules/notifications/notifications/model/RemoteNotificationContent.kt",
  "expo/modules/notifications/notifications/model/triggers/FirebaseNotificationTrigger.kt",
  "expo/modules/notifications/service/ExpoFirebaseMessagingService.kt",
  "expo/modules/notifications/service/delegates/FirebaseMessagingDelegate.kt",
  "expo/modules/notifications/service/interfaces/FirebaseMessagingDelegate.kt",
  "expo/modules/notifications/tokens/PushTokenModule.kt",
  "expo/modules/notifications/tokens/interfaces/FirebaseTokenListener.kt",
  "expo/modules/notifications/topics/TopicSubscriptionModule.kt",
]);

const replaceExact = (source, expected, replacement, file) => {
  if (!source.includes(expected)) {
    throw new Error(`Upstream drift in ${file}: expected source fragment was not found`);
  }
  return source.replace(expected, replacement);
};

const replaceRange = (source, start, end, replacement, file) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) {
    throw new Error(`Upstream drift in ${file}: expected source range was not found`);
  }
  return source.slice(0, startIndex) + replacement + source.slice(endIndex + end.length);
};

const collectSourceFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectSourceFiles(entryPath);
      return entry.name.endsWith(".java") || entry.name.endsWith(".kt") ? [entryPath] : [];
    })
  );
  return paths.flat();
};

const transform = (relativePath, input) => {
  let source = input;

  if (relativePath === "expo/modules/notifications/notifications/NotificationSerializer.java") {
    source = replaceExact(
      source,
      "import com.google.firebase.messaging.RemoteMessage;\n\n",
      "",
      relativePath
    );
    source = replaceExact(
      source,
      "import expo.modules.notifications.notifications.model.triggers.FirebaseNotificationTrigger;\n\n",
      "",
      relativePath
    );
    source = replaceRange(
      source,
      "      if (requestTrigger instanceof FirebaseNotificationTrigger trigger) {",
      "      } else if(\n",
      "      if (\n",
      relativePath
    );
  }

  if (relativePath === "expo/modules/notifications/notifications/debug/DebugLogging.kt") {
    source = replaceExact(
      source,
      "import com.google.firebase.messaging.RemoteMessage\n",
      "",
      relativePath
    );
    source = replaceRange(
      source,
      "  fun logRemoteMessage(caller: String, message: RemoteMessage) {",
      "\n  fun logNotification(caller: String, notification: Notification) {",
      "  fun logNotification(caller: String, notification: Notification) {",
      relativePath
    );
  }

  if (
    relativePath === "expo/modules/notifications/notifications/handling/NotificationsHandler.kt"
  ) {
    source = replaceExact(
      source,
      "import expo.modules.notifications.notifications.model.RemoteNotificationContent\n",
      "",
      relativePath
    );
    source = replaceRange(
      source,
      "    val content = notification.notificationRequest.content\n",
      "      return\n    }\n",
      "",
      relativePath
    );
  }

  if (relativePath === "expo/modules/notifications/service/delegates/ExpoHandlingDelegate.kt") {
    source = replaceRange(
      source,
      "    // Run background tasks only for custom notification action buttons (not the default tap).",
      "    }\n\n    // NOTE the listeners are not set up when the app is killed",
      "    // NOTE the listeners are not set up when the app is killed",
      relativePath
    );
  }

  return source;
};

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
await cp(upstreamRoot, outputRoot, {
  recursive: true,
  filter: (sourcePath) => {
    const relativePath = path.relative(upstreamRoot, sourcePath);
    return !excluded.has(relativePath);
  },
});

const transformedFiles = [
  "expo/modules/notifications/notifications/NotificationSerializer.java",
  "expo/modules/notifications/notifications/debug/DebugLogging.kt",
  "expo/modules/notifications/notifications/handling/NotificationsHandler.kt",
  "expo/modules/notifications/service/delegates/ExpoHandlingDelegate.kt",
];

for (const relativePath of transformedFiles) {
  const outputPath = path.join(outputRoot, relativePath);
  const source = await readFile(outputPath, "utf8");
  await writeFile(outputPath, transform(relativePath, source));
}

const bannedPatterns = [
  "com.google.android.gms",
  "com.google.android.play",
  "com.google.firebase",
  "FirebaseMessaging",
  "FirebaseNotificationTrigger",
  "FirebaseTokenListener",
];

for (const sourcePath of await collectSourceFiles(outputRoot)) {
  const relativePath = path.relative(outputRoot, sourcePath);
  const source = await readFile(sourcePath, "utf8");
  const bannedPattern = bannedPatterns.find((pattern) => source.includes(pattern));
  if (bannedPattern) {
    throw new Error(
      `${relativePath} still contains banned HMS dependency marker: ${bannedPattern}`
    );
  }
}
