import 'package:flutter/material.dart';
import 'package:nedaa/modules/settings/models/prayer_type.dart';
import 'package:nedaa/modules/settings/screens/notifications/iqama/iqama_prayer_settings_screen.dart';
import 'package:settings_ui/settings_ui.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';

class IqamaSettings extends StatefulWidget {
  const IqamaSettings({Key? key}) : super(key: key);

  @override
  State<IqamaSettings> createState() => _NotificationScreenState();
}

class _NotificationScreenState extends State<IqamaSettings> {
  AbstractSettingsTile _buildIqamaSettingsTile(
      PrayerType prayerType, String prayerName) {
    return SettingsTile(
      title: Text(prayerName),
      trailing: const Text(""),
      onPressed: (context) {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) =>
                IqamaPrayerSettingsScreen(prayerType, prayerName),
          ),
        );
      },
    );
  }

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
        child: SettingsList(
          sections: [
            SettingsSection(
              tiles: [
                _buildIqamaSettingsTile(PrayerType.fajr, t.fajr),
                _buildIqamaSettingsTile(PrayerType.duhur, t.duhur),
                _buildIqamaSettingsTile(PrayerType.asr, t.asr),
                _buildIqamaSettingsTile(PrayerType.maghrib, t.maghrib),
                _buildIqamaSettingsTile(PrayerType.isha, t.isha),
              ],
            )
          ],
        ),
      ),
    );
  }
}
