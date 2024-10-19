import 'dart:io';

import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:nedaa/modules/prayer_times/models/prayer_times.dart';
import 'package:nedaa/modules/settings/bloc/settings_bloc.dart';
import 'package:nedaa/modules/settings/bloc/user_settings_bloc.dart';
import 'package:nedaa/modules/settings/models/notification_settings.dart';
import 'package:nedaa/modules/settings/models/prayer_type.dart';
import 'package:nedaa/utils/arabic_digits.dart';
import 'package:nedaa/utils/helper.dart';
import 'package:timezone/standalone.dart' as tz;
import 'package:flutter_gen/gen_l10n/app_localizations.dart';

final FlutterLocalNotificationsPlugin _flutterLocalNotificationsPlugin =
    FlutterLocalNotificationsPlugin();
final AndroidFlutterLocalNotificationsPlugin
    _androidFlutterLocalNotificationsPlugin =
    AndroidFlutterLocalNotificationsPlugin();

void _handleForeground(NotificationResponse details) {
  debugPrint(
      'got notification ${details.id} ${details.input} ${details.payload}');
}

Future<bool> requestIOSNotificationPermissionsAndGetCurrent() async {
  if (Platform.isIOS) {
    var result = await _flutterLocalNotificationsPlugin
        .resolvePlatformSpecificImplementation<
            IOSFlutterLocalNotificationsPlugin>()
        ?.requestPermissions(
          alert: true,
          badge: true,
          sound: true,
        );

    if (result == null) {
      return false;
    } else {
      return result;
    }
  } else {
    return true;
  }
}

Future<void> initNotifications() async {
  final NotificationAppLaunchDetails? notificationAppLaunchDetails =
      !kIsWeb && Platform.isLinux
          ? null
          : await _flutterLocalNotificationsPlugin
              .getNotificationAppLaunchDetails();
  if (notificationAppLaunchDetails?.didNotificationLaunchApp ?? false) {
    debugPrint('notification was tapped');
  }

  const initializationSettingsAndroid =
      AndroidInitializationSettings('@mipmap/ic_launcher');

  const initializationSettingsIOS = DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false);

  const initializationSettings = InitializationSettings(
      android: initializationSettingsAndroid, iOS: initializationSettingsIOS);

  await _flutterLocalNotificationsPlugin.initialize(initializationSettings,
      onDidReceiveNotificationResponse: _handleForeground,
      onDidReceiveBackgroundNotificationResponse: _handleForeground);

  await requestIOSNotificationPermissionsAndGetCurrent();
}

Future<void> cancelNotifications() async {
  await _flutterLocalNotificationsPlugin.cancelAll();
}

NotificationDetails _buildNotificationDetails(NotificationSettings settings) {
  var ringtone = settings.ringtone;
  var baseFileName = ringtone.fileName.split('.').first;

  AndroidNotificationDetails androidPlatformChannelSpecifics =
      AndroidNotificationDetails(
    // use the baseFileName as the channel id
    // since in android you cannot change the sound after the channel is created
    'prayers $baseFileName',
    'Prayers Notification',
    channelDescription: 'Notifying prayers',
    importance: Importance.max,
    priority: Priority.high,
    sound: settings.sound
        ? RawResourceAndroidNotificationSound(baseFileName)
        : null,
    playSound: settings.sound,
    enableVibration: settings.vibration,
    ticker: 'ticker',
  );

  DarwinNotificationDetails darwinPlatformChannelSpecifics =
      DarwinNotificationDetails(
    sound: settings.sound ? "$baseFileName.m4r" : null,
    presentSound: settings.sound,
  );
  return NotificationDetails(
      android: androidPlatformChannelSpecifics,
      iOS: darwinPlatformChannelSpecifics);
}

Future<void> scheduleNotifications(
  BuildContext context,
  List<DayPrayerTimes> days,
) async {
  var userSettingsState = context.read<UserSettingsBloc>().state;
  var notificationSettings = userSettingsState.notificationSettings;

  var t = AppLocalizations.of(context);

  if (t == null) {
    // since we schedule on `main` before any widget appearing
    var locale = context.read<SettingsBloc>().state.appLanguage;
    t = await AppLocalizations.delegate.load(locale);
  }

  await scheduleNotificationsInner(
    t,
    notificationSettings,
    days,
  );
}

Future<void> scheduleNotificationsInner(
  AppLocalizations t,
  Map<PrayerType, PrayerNotificationSettings> notificationSettings,
  List<DayPrayerTimes> days,
) async {
  if (Platform.isIOS) {
    if (!(await requestIOSNotificationPermissionsAndGetCurrent())) {
      return;
    }
  }

  var prayersTranslation = {
    PrayerType.fajr: t.fajr,
    PrayerType.duhur: t.duhur,
    PrayerType.asr: t.asr,
    PrayerType.maghrib: t.maghrib,
    PrayerType.isha: t.isha,
  };

  await cancelNotifications();
  // clear old android channels
  if (Platform.isAndroid) {
    try {
      var channels = await _androidFlutterLocalNotificationsPlugin
          .getNotificationChannels();
      if (channels != null && channels.isNotEmpty) {
        for (var channel in channels) {
          await _androidFlutterLocalNotificationsPlugin
              .deleteNotificationChannel(channel.id);
        }
      }
    } catch (e) {
      debugPrint('error deleting channels: $e');
    }
  }

  if (days.isEmpty) return;
  var platformChannelDetails = _buildNotificationDetails(
      notificationSettings[PrayerType.fajr]!.athanSettings.notificationSettings);

  var id = 0;
  var now = getCurrentTimeWithTimeZone(
    days.first.timeZoneName,
  );

  var counter = 0;
  var lastTime = now;

  // iOS only allows 64 scheduled notifications at a time
  // we save the 64th notification to remind the user to open the app.
  var maxIOSNotification = 63;
  var breakOuterLoop = false;
  for (var day in days) {
    if (breakOuterLoop) break;
    for (var e in day.prayerTimes.entries) {
      // ignore sunrise
      if (e.key == PrayerType.sunrise) {
        continue;
      }

      var prayerNotificationSettings = notificationSettings[e.key]!;

      var athanPlatformChannelDetails =
          _buildNotificationDetails(prayerNotificationSettings.athanSettings.notificationSettings);
      var prayerTime = tz.TZDateTime.from(
        e.value,
        tz.getLocation(day.timeZoneName),
      );
      ++id;
      if (prayerTime.isBefore(now)) continue;

      String prayerName;
      // if weekday=5 (Friday) and prayer is duhur then prayerName=jumuah
      if (day.date.weekday == 5 && e.key == PrayerType.duhur) {
        prayerName = t.jumuah;
      } else {
        prayerName = prayersTranslation[e.key] ?? "";
      }

      // Schedule PreAthan notification
      var preAthanSettings = prayerNotificationSettings.preAthanSettings;
      if (preAthanSettings.enabled && counter < maxIOSNotification) {
        var preAthanTime =
            prayerTime.subtract(Duration(minutes: preAthanSettings.before));
        // Avoid scheduling notifications in the past
        if (preAthanTime.isAfter(now)) {
          var preAthanPlatformChannelDetails =
              _buildNotificationDetails(preAthanSettings.notificationSettings);

          await _flutterLocalNotificationsPlugin.zonedSchedule(
            id,
            t.preAthanTimeNotificationTitle(prayerName),
            t.preAthanTimeNotificationContent(
                translateNumber(t, preAthanSettings.before.toString()),
                prayerName),
            preAthanTime,
            preAthanPlatformChannelDetails,
            androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
            uiLocalNotificationDateInterpretation:
                UILocalNotificationDateInterpretation.absoluteTime,
          );
          counter++;
          id++;
        }
      }

      await _flutterLocalNotificationsPlugin.zonedSchedule(
        id,
        t.prayerTimeNotificationTitle(prayerName),
        t.prayerTimeNotificationContent(prayerName),
        prayerTime,
        athanPlatformChannelDetails,
        androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
        uiLocalNotificationDateInterpretation:
            UILocalNotificationDateInterpretation.absoluteTime,
      );
      counter++;
      id++;

      var iqamaSettings = prayerNotificationSettings.iqamaSettings;
      if (iqamaSettings.enabled && counter < maxIOSNotification) {
        var iqamaPlatformChannelDetails =
            _buildNotificationDetails(iqamaSettings.notificationSettings);
        var iqamaTime = prayerTime.add(Duration(minutes: iqamaSettings.delay));

        await _flutterLocalNotificationsPlugin.zonedSchedule(
          id,
          t.iqamaTimeNotificationTitle(prayerName),
          t.iqamaTimeNotificationContent(
              translateNumber(t, iqamaSettings.delay.toString()), prayerName),
          iqamaTime,
          iqamaPlatformChannelDetails,
          androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
          uiLocalNotificationDateInterpretation:
              UILocalNotificationDateInterpretation.absoluteTime,
        );
        counter++;
      }

      // reached the iOS schedule limit (64)
      if (counter == maxIOSNotification) {
        debugPrint('breaking with $counter notifications');
        breakOuterLoop = true;
        break;
      }
      lastTime = prayerTime;
    }
  }

  // remind the user to open the app
  await _flutterLocalNotificationsPlugin.zonedSchedule(
    id,
    t.openAppReminderTitle,
    t.openAppReminderContent,
    lastTime.add(const Duration(minutes: 10)),
    platformChannelDetails,
    androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
    uiLocalNotificationDateInterpretation:
        UILocalNotificationDateInterpretation.absoluteTime,
  );

  debugPrint(
    "scheduled ${(await _flutterLocalNotificationsPlugin.pendingNotificationRequests()).length} notifications",
  );
}

Future<List<PendingNotificationRequest>> getPendingNotifications() async {
  return await _flutterLocalNotificationsPlugin.pendingNotificationRequests();
}
