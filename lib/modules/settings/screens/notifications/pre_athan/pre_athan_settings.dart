import 'package:flutter/material.dart';
import 'package:nedaa/modules/settings/models/prayer_type.dart';
import 'package:nedaa/modules/settings/screens/notifications/pre_athan/pre_athan_settings_screen.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';

class PreAthanSettings extends StatefulWidget {
  const PreAthanSettings({Key? key}) : super(key: key);

  @override
  State<PreAthanSettings> createState() => _NotificationScreenState();
}

class _NotificationScreenState extends State<PreAthanSettings> {
  @override
  void initState() {
    super.initState();
  }

  @override
  Widget build(BuildContext context) {
    var t = AppLocalizations.of(context)!;

    return Scaffold(
        appBar: AppBar(
          title: Text(t.notification),
        ),
        body: Padding(
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
            )));
  }
}
