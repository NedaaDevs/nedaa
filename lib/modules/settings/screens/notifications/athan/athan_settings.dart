import 'package:flutter/material.dart';
import 'package:nedaa/modules/settings/models/prayer_type.dart';
import 'package:nedaa/modules/settings/screens/notifications/athan/athan_prayer_settings_screen.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';

class AthanSettings extends StatelessWidget {
  const AthanSettings({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    var t = AppLocalizations.of(context)!;

    return Scaffold(
        appBar: AppBar(
          title: Text(t.athanNotifications),
        ),
        body: Padding(
          padding: const EdgeInsets.only(top: 8.0),
          child: SingleChildScrollView(
            child: Column(
              children: [
                AthanPrayerSettingsScreen(PrayerType.fajr, t.fajr),
                AthanPrayerSettingsScreen(PrayerType.duhur, t.duhur),
                AthanPrayerSettingsScreen(PrayerType.asr, t.asr),
                AthanPrayerSettingsScreen(PrayerType.maghrib, t.maghrib),
                AthanPrayerSettingsScreen(PrayerType.isha, t.isha),
              ],
            ),
          ),
        ));
  }
}
