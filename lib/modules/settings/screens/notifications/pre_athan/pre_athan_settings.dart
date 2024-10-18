import 'dart:io';

import 'package:flutter/material.dart';
import 'package:nedaa/modules/notifications/notifications.dart';
import 'package:nedaa/modules/settings/models/prayer_type.dart';
import 'package:nedaa/modules/settings/screens/notifications/pre_athan/pre_athan_settings_screen.dart';
import 'package:nedaa/utils/location_permission_utils.dart';
import 'package:settings_ui/settings_ui.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';

class PreAthanSettings extends StatefulWidget {
  const PreAthanSettings({Key? key}) : super(key: key);

  @override
  State<PreAthanSettings> createState() => _NotificationScreenState();
}

class _NotificationScreenState extends State<PreAthanSettings> {
  bool? permission;

  @override
  void initState() {
    super.initState();

    requestIOSNotificationPermissionsAndGetCurrent().then((value) => {
          setState(() {
            permission = value;
          })
        });
  }

  @override
  Widget build(BuildContext context) {
    // loading
    if (permission == null) {
      return const Center(
        child: CircularProgressIndicator(),
      );
    }

    var t = AppLocalizations.of(context)!;

    Widget body;
    if (Platform.isIOS && !permission!) {
      body = SettingsList(
        sections: [
          SettingsSection(
            title: Text(t.prayersAlerts),
            tiles: [
              SettingsTile.switchTile(
                initialValue: permission,
                onToggle: (value) {
                  // open settings
                  openAppSettings().then((_) {
                    Navigator.pop(context);
                  });
                },
                title: Text(t.allowNotifications),
                leading: const Icon(
                  Icons.notifications_off,
                ),
              )
            ],
          ),
        ],
      );
    } else {
      body = Padding(
          padding: const EdgeInsets.only(top: 8.0),
          child: SingleChildScrollView(
            child: Column(
              children: [
                PreAthanNotificationsScreen(PrayerType.fajr, t.fajr),
                PreAthanNotificationsScreen(PrayerType.duhur, t.duhur),
                PreAthanNotificationsScreen(PrayerType.asr, t.asr),
                PreAthanNotificationsScreen(PrayerType.maghrib, t.maghrib),
                PreAthanNotificationsScreen(PrayerType.isha, t.isha),
              ],
            ),
          ));
    }

    return Scaffold(
        appBar: AppBar(
          title: Text(t.notification),
        ),
        body: body);
  }
}
