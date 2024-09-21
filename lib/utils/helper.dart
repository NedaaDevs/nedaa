import 'package:device_info_plus/device_info_plus.dart';
import 'package:geocoding/geocoding.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:home_widget/home_widget.dart';
import 'package:nedaa/constants/app_constans.dart';
import 'package:nedaa/constants/default_timezone_calculation_method.dart';
import 'package:nedaa/modules/prayer_times/models/prayer_times.dart';
import 'package:nedaa/modules/settings/models/calculation_method.dart';
import 'package:nedaa/modules/settings/models/prayer_type.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:timezone/standalone.dart' as tz;
import 'dart:async';
import 'dart:io';

String generateParams(Location location, CalculationMethod method, int? year,
    {bool annual = true, String? timezone}) {
  var selectedYear = year ??
      ((timezone != null)
          ? getCurrentTimeWithTimeZone(timezone).year
          : DateTime.now().year);
  var methodIndex = method.index;
  if (methodIndex == -1) {
    methodIndex = defaultMethod[timezone] ?? -1;
  }
  var calculationMethod = methodIndex != -1 ? '&method=$methodIndex' : '';
  return 'year=$selectedYear&annual=$annual&iso8601=true&latitude=${location.latitude}&longitude=${location.longitude}$calculationMethod';
}

PrayerTime getNextPrayer(
    DayPrayerTimes todayPrayerTimes, DayPrayerTimes tomorrowPrayerTimes) {
  var now = getCurrentTimeWithTimeZone(todayPrayerTimes.timeZoneName);

  var nextPrayer = PrayerType.values
      .map((prayerType) => PrayerTime(
            todayPrayerTimes.prayerTimes[prayerType] ?? now,
            todayPrayerTimes.timeZoneName,
            prayerType,
          ))
      .firstWhere(
    (prayerTime) {
      // if (prayerType == PrayerType.sunrise) return false;

      var tzPrayerTime =
          getDateWithTimeZone(todayPrayerTimes.timeZoneName, prayerTime.time);

      return tzPrayerTime.isAfter(now);
    },
    orElse: () {
      return PrayerTime(
        tomorrowPrayerTimes.prayerTimes[PrayerType.fajr] ?? now,
        tomorrowPrayerTimes.timeZoneName,
        PrayerType.fajr,
      );
    },
  );

  return nextPrayer;
}

PrayerTime getPreviousPrayer(
    DayPrayerTimes todayPrayerTimes, DayPrayerTimes yesterdayPrayerTimes) {
  var now = getCurrentTimeWithTimeZone(todayPrayerTimes.timeZoneName);

  var nextPrayer = PrayerType.values.reversed
      .map((prayerType) => PrayerTime(
            todayPrayerTimes.prayerTimes[prayerType] ?? now,
            todayPrayerTimes.timeZoneName,
            prayerType,
          ))
      .firstWhere(
    (prayerTime) {
      // if (prayerType == PrayerType.sunrise) return false;

      var tzPrayerTime =
          getDateWithTimeZone(todayPrayerTimes.timeZoneName, prayerTime.time);

      return tzPrayerTime.isBefore(now);
    },
    orElse: () {
      return PrayerTime(
        yesterdayPrayerTimes.prayerTimes[PrayerType.isha] ?? now,
        yesterdayPrayerTimes.timeZoneName,
        PrayerType.isha,
      );
    },
  );

  return nextPrayer;
}

tz.TZDateTime getDateWithTimeZone(String timeZoneName, DateTime date) =>
    tz.TZDateTime.from(date, tz.getLocation(timeZoneName));

tz.TZDateTime getCurrentTimeWithTimeZone(String timeZoneName) =>
    tz.TZDateTime.now(tz.getLocation(timeZoneName));

Future<bool> hasInternetConnection() async {
  bool? isConnectionSuccessful;
  try {
    final response = await InternetAddress.lookup('www.google.com');

    isConnectionSuccessful = response.isNotEmpty;
  } on SocketException catch (_) {
    isConnectionSuccessful = false;
  }
  return isConnectionSuccessful;
}

String duhurOrJumuah(int weekday, AppLocalizations t) {
  // weekday=5 means day is Friday.
  if (weekday == 5) {
    return t.jumuah;
  }
  return t.duhur;
}

// Get package info string
Future<String> getPackageInfo() async {
  PackageInfo packageInfo = await PackageInfo.fromPlatform();

  return 'Version: ${packageInfo.version}+${packageInfo.buildNumber}';
}

// Get device info string
Future<String> getDeviceInfo() async {
  DeviceInfoPlugin deviceInfo = DeviceInfoPlugin();
  var deviceData = 'Unknown';

  if (Platform.isAndroid) {
    AndroidDeviceInfo androidInfo = await deviceInfo.androidInfo;
    var model = androidInfo.model;
    var version = androidInfo.version;
    deviceData = '$model $version';
  } else if (Platform.isIOS) {
    IosDeviceInfo iosInfo = await deviceInfo.iosInfo;
    var systemVersion = iosInfo.systemVersion;
    var model = iosInfo.model;
    var localizedModel = iosInfo.localizedModel;
    deviceData = '$systemVersion $model $localizedModel';
  }

  return deviceData;
}

String resolveDeviceLocale() {
  var locale = Platform.localeName;
  if (locale.contains('_')) {
    locale = locale.split('_')[0];
  }
  return locale;
}

Future updateiOSWidgets() async {
  for (var name in iOSWidgetNames) {
    await HomeWidget.updateWidget(
      name: name,
      iOSName: name,
    );
  }
}

Future updateAndroidWidgets() async {
  for (var name in androidWidgetNames) {
    await HomeWidget.updateWidget(name: name, androidName: name);
  }
}
