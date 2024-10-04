import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:nedaa/modules/settings/models/calculation_method.dart';
import 'package:nedaa/modules/settings/models/notification_settings.dart';
import 'package:nedaa/modules/settings/models/prayer_type.dart';
import 'package:nedaa/modules/settings/models/user_location.dart';
import 'package:nedaa/utils/helper.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SettingsRepository {
  SettingsRepository(SharedPreferences sharedPerf) : _sharedPref = sharedPerf;

  final SharedPreferences _sharedPref;

  String? _getString(String key) {
    return _sharedPref.getString(key);
  }

  Future<void> _setString(String key, String value) async {
    await _sharedPref.setString(key, value);
  }

  int? _getInt(String key) {
    return _sharedPref.getInt(key);
  }

  Future<void> _setInt(String key, int value) async {
    await _sharedPref.setInt(key, value);
  }

  bool? _getBool(String key) {
    return _sharedPref.getBool(key);
  }

  Future<void> _setBool(String key, bool value) async {
    await _sharedPref.setBool(key, value);
  }

  ThemeMode getTheme() {
    var theme = _getString('theme');
    switch (theme) {
      case 'ThemeMode.light':
        return ThemeMode.light;
      case 'ThemeMode.dark':
        return ThemeMode.dark;
      case 'ThemeMode.system':
        return ThemeMode.system;
      default:
        return ThemeMode.system;
    }
  }

  setTheme(ThemeMode theme) async {
    await _setString('theme', theme.toString());
  }

  Locale getLanguage() {
    var language = _getString('language');

    // initally the language is null
    // so we'll use the system language as the default language
    // or default to english if the system language is not supported
    language ??= resolveDeviceLocale();

    switch (language) {
      case 'en':
        return const Locale('en');
      case 'ar':
        return const Locale('ar');
      default:
        return const Locale('en');
    }
  }

  setLanguage(Locale language) async {
    await _setString('language', language.languageCode);
  }

  CalculationMethod getCalculationMethod() {
    var methodIndex = _getInt('calculationMethod') ?? -1;

    return CalculationMethod(methodIndex);
  }

  setCalculationMethod(CalculationMethod method) async {
    await _setInt('calculationMethod', method.index);
  }

  UserLocation getUserLocation() {
    var location = _getString('location');
    if (location == null) {
      return UserLocation();
    }

    var map = json.decode(location);
    if (map is Map<String, dynamic>) {
      return UserLocation.fromJson(map);
    }
    return UserLocation();
  }

  setUserLocation(UserLocation location) async {
    await _setString('location', json.encode(location.toJson()));
  }

  bool getKeepUpdatingLocation() {
    return _getBool('keepUpdatingLocation') ?? false;
  }

  setKeepUpdatingLocation(bool keepUpdating) async {
    await _setBool('keepUpdatingLocation', keepUpdating);
  }

  setNotificationSettings(
      Map<PrayerType, PrayerNotificationSettings> notificationSettings) async {
    var map = json.encode(notificationSettings
        .map((key, value) => MapEntry(key.name, value.toJson())));
    await _setString('notificationSettings', map);
  }

  Map<PrayerType, PrayerNotificationSettings> getNotificationSettings() {
    var settings = _getString('notificationSettings');

    var jsonMap = {};
    if (settings != null) {
      jsonMap = json.decode(settings);
    }

    var settingsMap = <PrayerType, PrayerNotificationSettings>{};

    for (var type in PrayerType.values) {
      if (jsonMap.containsKey(type.name)) {
        try {
          settingsMap[type] =
              PrayerNotificationSettings.fromJson(jsonMap[type.name]);
        } catch (e) {
          settingsMap[type] = PrayerNotificationSettings.defaultValue();
        }
      } else {
        settingsMap[type] = PrayerNotificationSettings.defaultValue();

        // override Maghrib default value to 5 minutes
        if (type.name == PrayerType.maghrib.name) {
          settingsMap[type]?.iqamaSettings.delay = 5;
        }
      }
    }
    return settingsMap;
  }

  bool isFirstRun() {
    return _getBool('isFirstRun') ?? true;
  }

  setIsFirstRun(bool isFirstRun) async {
    await _setBool('isFirstRun', isFirstRun);
  }

  setFont(String font) async {
    await _setString('font', font);
  }

  String getFont() {
    return _getString('font') ?? '';
  }

  setTimezone(String timezone) async {
    await _setString('timezone', timezone);
  }

  String getTimezone() {
    return _getString('timezone') ?? 'Etc/UTC';
  }

  setSendCrashReports(bool value) async {
    await _setBool('sendCrashReports', value);
  }

  bool getSendCrashReports() {
    var value = _getBool('sendCrashReports');
    return value ?? true;
  }
}
