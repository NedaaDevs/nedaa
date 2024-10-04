import 'dart:async';
import 'dart:io';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:nedaa/constants/ringtones.dart';
import 'package:nedaa/modules/prayer_times/bloc/prayer_times_bloc.dart';
import 'package:nedaa/modules/settings/models/notification_settings.dart';
import 'package:nedaa/modules/settings/models/prayer_type.dart';
import 'package:nedaa/modules/settings/repositories/settings_repository.dart';
import 'package:settings_ui/settings_ui.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:nedaa/modules/settings/bloc/user_settings_bloc.dart';

class AthanPrayerSettingsScreen extends StatefulWidget {
  const AthanPrayerSettingsScreen(this.prayerType, this.prayerName, {Key? key})
      : super(key: key);

  final PrayerType prayerType;
  final String prayerName;

  @override
  State<AthanPrayerSettingsScreen> createState() =>
      _AthanPrayerSettingsScreenState();
}

class _AthanPrayerSettingsScreenState extends State<AthanPrayerSettingsScreen> {
  Timer? _debounce;
  // or as a local variable
  final player = AudioPlayer();

  @override
  void dispose() {
    var active = _debounce?.isActive ?? false;
    _debounce?.cancel();

    if (active) {
      _triggerRefetch();
    }

    super.dispose();
  }

  Future<void> _triggerRefetch() async {
    var settingsRepo = context.read<SettingsRepository>();
    var userLocation = settingsRepo.getUserLocation();
    var calculationMethod = settingsRepo.getCalculationMethod();
    var timezone = settingsRepo.getTimezone();
    context
        .read<PrayerTimesBloc>()
        .add(FetchPrayerTimesEvent(userLocation, calculationMethod, timezone));
  }

  SettingsTile _ringtoneTile(
    BuildContext context,
    AppLocalizations t,
    NotificationSettings settings,
    void Function() onUpdate,
    NotificationRingtone ringtone,
  ) {
    var locale = Localizations.localeOf(context);
    var translations = ringtoneTranslations[locale.languageCode] ??
        ringtoneTranslations['en']!;

    return SettingsTile(
      title: Text(translations[ringtone.displayId] ?? '??'),
      trailing: ringtone.displayId == settings.ringtone.displayId
          ? const Icon(Icons.check)
          : null,
      onPressed: (context) async {
        settings.ringtone = ringtone;
        onUpdate();

        player.play(AssetSource(ringtone.fileName));

        player.onPlayerComplete.listen((event) {
          Navigator.pop(context);
        });

        await showModalBottomSheet(
          context: context,
          builder: (context) {
            return TextButton(
              child: Text(t.stop),
              onPressed: () {
                if (player.state == PlayerState.playing) {
                  player.stop();
                  Navigator.pop(context);
                }
              },
            );
          },
        );
        await player.stop();
      },
    );
  }

  List<AbstractSettingsSection> _notificationSettingsSections(
      AppLocalizations t,
      NotificationSettings settings,
      List<NotificationRingtone> ringtoneList,
      void Function() onUpdate) {
    return [
      // hide vibration for iOS users because it's not supported
      if (!Platform.isIOS)
        SettingsSection(
          tiles: [
            SettingsTile.switchTile(
              initialValue: settings.vibration,
              onToggle: (value) {
                settings.vibration = value;
                onUpdate();
              },
              title: Text(t.vibrate),
              leading: const Icon(Icons.vibration),
            ),
          ],
        ),
      SettingsSection(
        tiles: [
          SettingsTile.switchTile(
            initialValue: settings.sound,
            onToggle: (value) {
              settings.sound = value;

              onUpdate();
            },
            title: Text(t.alertOn),
            leading: settings.sound
                ? const Icon(Icons.volume_up)
                : const Icon(Icons.volume_off),
          ),
        ],
      ),
      if (settings.sound)
        SettingsSection(
            tiles: ringtoneList
                .map(
                  (e) => _ringtoneTile(context, t, settings, onUpdate, e),
                )
                .toList()),
    ];
  }

  @override
  Widget build(BuildContext context) {
    var t = AppLocalizations.of(context);

    var currentUserState = context.watch<UserSettingsBloc>().state;
    var prayerNotificationSettings =
        currentUserState.notificationSettings[widget.prayerType]!;

    onUpdate() {
      context.read<UserSettingsBloc>().add(
            PrayerNotificationEvent(
                widget.prayerType, prayerNotificationSettings),
          );
      // reschedule notifications with the new settings.
      // debounce scheduling to avoid scheduling multiple times in a short period of time.
      if (_debounce?.isActive ?? false) _debounce!.cancel();
      _debounce = Timer(const Duration(milliseconds: 1000), () async {
        await _triggerRefetch();
      });
    }

    var athanSections = _notificationSettingsSections(
      t!,
      prayerNotificationSettings.athanSettings,
      athanRingtones,
      onUpdate,
    );
    var iqamaSections = <AbstractSettingsSection>[];

    var isIqamaEnabled = prayerNotificationSettings.iqamaSettings.enabled;
    var iqamaEnableSection = SettingsSection(
      tiles: [
        SettingsTile.switchTile(
          initialValue: isIqamaEnabled,
          onToggle: (value) {
            prayerNotificationSettings.iqamaSettings.enabled = value;

            onUpdate();
          },
          title: Text(t.enableIqamaNotification),
          leading: isIqamaEnabled
              ? const Icon(Icons.notifications_active)
              : const Icon(Icons.notifications_off),
        ),
      ],
    );
    iqamaSections.add(iqamaEnableSection);

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.prayerName),
      ),
      body: SettingsList(
        sections: athanSections,
      ),
    );
  }
}
