# R8 keep rules for what library consumer rules miss; each target is reached by reflection.

# Line numbers keep shared JVM crash traces readable against the mapping file.
-keepattributes SourceFile,LineNumberTable

# ExpoModulesHelper loads the Expo module registry by name.
-keep class expo.modules.ExpoModulesPackageList { *; }

# Fresco resolves this constructor by name for animated images.
-keep class com.facebook.fresco.animation.factory.AnimatedFactoryV2Impl {
    public <init>(com.facebook.imagepipeline.bitmaps.PlatformBitmapFactory, com.facebook.imagepipeline.core.ExecutorSupplier, com.facebook.imagepipeline.cache.CountingMemoryCache, boolean, boolean, int, int, com.facebook.common.executors.SerialExecutorService);
}

# ExpoWidgetsModule calls these through a runtime method name.
-keep class dev.nedaa.android.widgets.notification.PrayerNotificationPublisher {
    public static void publishFromBridge(android.content.Context);
    public static void cancelFromBridge(android.content.Context);
}

# Glance stores the widget class name and resolves it on later updates.
-keepnames class * extends androidx.glance.appwidget.GlanceAppWidget

# expo-modules-core's C++ registers natives on these by class name.
-keepnames class expo.modules.kotlin.jni.JNIUtils
-keepnames class expo.modules.kotlin.jni.WorkletRuntimeInstaller
-keepnames class expo.modules.kotlin.jni.worklets.Worklet
-keepnames class expo.modules.kotlin.jni.worklets.WorkletNativeRuntime

# Record fields are read through annotation proxies, which R8 cannot see.
-keep @interface expo.modules.kotlin.records.Field
-keep @interface expo.modules.kotlin.records.Required

# expo-modules-core names its headless loader only in manifest meta-data.
-keep class expo.modules.adapters.react.apploader.RNHeadlessAppLoader { <init>(); }

# Room instantiates the generated `_Impl` database through its no-arg constructor by name.
-keep class * extends androidx.room.RoomDatabase { <init>(); }
