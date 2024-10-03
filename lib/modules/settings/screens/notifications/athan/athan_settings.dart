import 'package:flutter/material.dart';
import 'package:nedaa/modules/settings/models/prayer_type.dart';
import 'package:nedaa/modules/settings/screens/notifications/athan/athan_prayer_settings_screen.dart';
import 'package:settings_ui/settings_ui.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';

class AthanSettings extends StatelessWidget {
  const AthanSettings({Key? key}) : super(key: key);

  AbstractSettingsTile _buildAthanSettingsTile(
      BuildContext context, PrayerType prayerType, String prayerName) {
    return SettingsTile(
      title: Text(prayerName),
      trailing: const Icon(Icons.chevron_right),
      onPressed: (context) {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) =>
                AthanPrayerSettingsScreen(prayerType, prayerName),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    var t = AppLocalizations.of(context)!;

    return Scaffold(
      appBar: AppBar(
        title: Text(t.athanNotifications),
      ),
      body: Padding(
        padding: const EdgeInsets.only(top: 8.0),
        child: SettingsList(
          sections: [
            SettingsSection(
              tiles: [
                _buildAthanSettingsTile(context, PrayerType.fajr, t.fajr),
                _buildAthanSettingsTile(context, PrayerType.duhur, t.duhur),
                _buildAthanSettingsTile(context, PrayerType.asr, t.asr),
                _buildAthanSettingsTile(context, PrayerType.maghrib, t.maghrib),
                _buildAthanSettingsTile(context, PrayerType.isha, t.isha),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
