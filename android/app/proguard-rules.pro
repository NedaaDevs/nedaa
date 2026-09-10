# R8 keep rules for release builds.
#
# Only rules that are NOT already supplied by a library's own consumer file belong here.
# React Native, expo-modules-core, expo, reanimated, worklets, WorkManager, Glance, DataStore,
# kotlin-reflect, coroutines and the Huawei AARs all ship their own; duplicating them here
# would hide where the coverage actually comes from.
#
# Everything below protects something reached by reflection, which R8 cannot see. Each failure
# mode is written out because most of them are silent at build time and only appear at runtime.

# Readable stack traces. The app has no remote crash reporting: JVM crashes are formatted by
# modules/expo-diagnostics and shared by hand, then read against local-data/crash-triage.
# Without these attributes every frame loses its line number and no mapping file can restore it.
# `-renamesourcefileattribute` is deliberately NOT set: the real source file name is what tells
# a reader whether a trace came from an obfuscated build.
-keepattributes SourceFile,LineNumberTable

# The sole entry point to the Expo module registry, reached only by reflection
# (ExpoModulesHelper.kt Class.forName + newInstance). Expo's own consumer file uses
# -keepclassmembers, which preserves members only if the class itself survives — it does not
# keep the class. Without this, no Expo module loads.
-keep class expo.modules.ExpoModulesPackageList { *; }

# Fresco loads its animated-image factory by name and resolves this exact constructor
# signature (AnimatedFactoryProvider.getAnimatedFactory). No Fresco AAR ships a proguard.txt,
# and the class is marked with Fresco's own DoNotStrip, which React Native's rules do not cover.
# Stripped, an animated GIF renders as a static first frame.
-keep class com.facebook.fresco.animation.factory.AnimatedFactoryV2Impl {
    public <init>(com.facebook.imagepipeline.bitmaps.PlatformBitmapFactory, com.facebook.imagepipeline.core.ExecutorSupplier, com.facebook.imagepipeline.cache.CountingMemoryCache, boolean, boolean, int, int, com.facebook.common.executors.SerialExecutorService);
}

# ExpoWidgetsModule reaches these two through Class.forName().getMethod(methodName, ...) where
# methodName is a runtime value, so R8 cannot trace the call. The invocation sits inside
# runCatching: stripped, the persistent prayer-times notification silently never publishes or
# cancels, with no crash and nothing a user would think to report.
-keep class dev.nedaa.android.widgets.notification.PrayerNotificationPublisher {
    public static void publishFromBridge(android.content.Context);
    public static void cancelFromBridge(android.content.Context);
}

# Glance persists the widget's class name and resolves it on later updates, so the name must
# survive even though the body may be optimised. Renamed, placed widgets stop updating.
-keepnames class * extends androidx.glance.appwidget.GlanceAppWidget

# expo-modules-core's C++ resolves these four by descriptor string and calls registerNatives(),
# which fails hard on a renamed class. They are the ones in that set without the DoNotStrip
# annotation expo's consumer rule keys on. -keepnames allows shrinking, so this costs nothing.
-keepnames class expo.modules.kotlin.jni.JNIUtils
-keepnames class expo.modules.kotlin.jni.WorkletRuntimeInstaller
-keepnames class expo.modules.kotlin.jni.worklets.Worklet
-keepnames class expo.modules.kotlin.jni.worklets.WorkletNativeRuntime
