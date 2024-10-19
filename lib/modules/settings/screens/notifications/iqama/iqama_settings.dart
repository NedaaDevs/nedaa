import 'package:flutter/material.dart';
import 'package:nedaa/modules/settings/models/prayer_type.dart';
import 'package:nedaa/modules/settings/screens/notifications/iqama/iqama_prayer_settings_screen.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';

class IqamaSettings extends StatefulWidget {
  const IqamaSettings({Key? key}) : super(key: key);

  @override
  State<IqamaSettings> createState() => _NotificationScreenState();
}

class _NotificationScreenState extends State<IqamaSettings> {
  @override
  void initState() {
    super.initState();
  }

  @override
  Widget build(BuildContext context) {
    var t = AppLocalizations.of(context);

    return Scaffold(
        appBar: AppBar(
          title: Text(t!.notification),
        ),
        body: Padding(
            padding: const EdgeInsets.only(top: 8.0),
            child: SingleChildScrollView(
              child: Column(
                children: [
                  IqamaPrayerSettingsScreen(PrayerType.fajr, t.fajr),
                  IqamaPrayerSettingsScreen(PrayerType.duhur, t.duhur),
                  IqamaPrayerSettingsScreen(PrayerType.asr, t.asr),
                  IqamaPrayerSettingsScreen(PrayerType.maghrib, t.maghrib),
                  IqamaPrayerSettingsScreen(PrayerType.isha, t.isha),
                ],
              ),
            )));
  }
}
