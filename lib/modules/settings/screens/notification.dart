import 'dart:io';

import 'package:flutter/material.dart';
import 'package:nedaa/modules/notifications/notifications.dart';
import 'package:nedaa/modules/settings/screens/notifications/athan/athan_settings.dart';
import 'package:nedaa/modules/settings/screens/notifications/iqama/iqama_settings.dart';
import 'package:nedaa/modules/settings/screens/notifications/pre_athan/pre_athan_settings.dart';
import 'package:nedaa/utils/location_permission_utils.dart';
import 'package:settings_ui/settings_ui.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';

class NotificationScreen extends StatefulWidget {
  const NotificationScreen({Key? key}) : super(key: key);

  @override
  State<NotificationScreen> createState() => _NotificationScreenState();
}

class _NotificationScreenState extends State<NotificationScreen> {
  bool? permission;

  void _navigateToSettingsScreen(
      BuildContext context, String title, Widget screen) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => screen,
      ),
    );
  }

  AbstractSettingsTile _buildSettingsTile(String title, Widget screen) {
    return SettingsTile(
      title: Text(title),
      trailing: const Icon(Icons.chevron_right),
      onPressed: (context) => _navigateToSettingsScreen(context, title, screen),
    );
  }

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
    if (permission == null) {
      return const Center(
        child: CircularProgressIndicator(),
      );
    }

    var t = AppLocalizations.of(context)!;

    SettingsSection settingsSection;
    if (Platform.isIOS && !permission!) {
      settingsSection = SettingsSection(title: Text(t.prayersAlerts), tiles: [
        SettingsTile.switchTile(
          initialValue: permission,
          onToggle: (value) {
            openAppSettings().then((_) {
              Navigator.pop(context);
            });
          },
          title: Text(t.allowNotifications),
          leading: const Icon(Icons.notifications_off),
        )
      ]);
    } else {
      settingsSection = SettingsSection(
        title: Text(t.prayersAlerts),
        tiles: [
          _buildSettingsTile(
            t.preAthanNotifications,
            const PreAthanSettings(),
          ),
          _buildSettingsTile(t.athanNotifications, const AthanSettings()),
          _buildSettingsTile(
            t.iqamaNotifications,
            const IqamaSettings(),
          ),
        ],
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(t.notification),
      ),
      body: Padding(
        padding: const EdgeInsets.only(top: 8.0),
        child: SettingsList(
          sections: [settingsSection],
        ),
      ),
    );
  }
}

//TODO: Implement

