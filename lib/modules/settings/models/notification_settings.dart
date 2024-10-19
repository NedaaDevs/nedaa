const athanRingtones = [
  NotificationRingtone(displayId: 'takbir', fileName: 'takbir.mp3'),
  NotificationRingtone(displayId: 'knock', fileName: 'knock.mp3'),
  NotificationRingtone(displayId: 'beep', fileName: 'beep.mp3'),
  NotificationRingtone(displayId: 'athan1', fileName: 'athan1.mp3'),
  NotificationRingtone(displayId: 'athan8', fileName: 'athan8.mp3'),
  NotificationRingtone(displayId: 'athan2', fileName: 'athan6.mp3'),
  NotificationRingtone(displayId: 'medina_athan', fileName: 'medina_athan.mp3'),
  NotificationRingtone(
      displayId: 'yasser_aldosari', fileName: 'yasser_aldosari.mp3'),
];

const iqamaRingtones = [
  NotificationRingtone(displayId: 'takbir', fileName: 'takbir.mp3'),
  NotificationRingtone(displayId: 'knock', fileName: 'knock.mp3'),
  NotificationRingtone(displayId: 'beep', fileName: 'beep.mp3'),
  NotificationRingtone(displayId: 'iqama1', fileName: 'iqama1.mp3'),
];

const preAthanRingtones = [
  NotificationRingtone(displayId: 'tasbih', fileName: 'tasbih.mp3'),
  NotificationRingtone(displayId: 'knock', fileName: 'knock.mp3'),
  NotificationRingtone(displayId: 'beep', fileName: 'beep.mp3'),
];

class NotificationRingtone {
  final String displayId;
  final String fileName;

  const NotificationRingtone({
    required this.displayId,
    required this.fileName,
  });
}

class PreAthanSettings {
  PreAthanSettings({
    required this.enabled,
    required this.notificationSettings,
    required this.before,
  });

  bool enabled;
  NotificationSettings notificationSettings;
  int before;

  factory PreAthanSettings.defaultValue() => PreAthanSettings(
        enabled: false,
        notificationSettings: NotificationSettings(
          sound: true,
          vibration: false,
          ringtone: preAthanRingtones[0],
        ),
        before: 15,
      );

  factory PreAthanSettings.fromJson(Map<String, dynamic> json) =>
      PreAthanSettings(
        enabled: json["enabled"],
        notificationSettings:
            NotificationSettings.fromJson(json["notificationSettings"]),
        before: json["before"],
      );

  Map<String, dynamic> toJson() => {
        "enabled": enabled,
        "notificationSettings": notificationSettings.toJson(),
        "before": before,
      };
}

class AthanSettings {
  AthanSettings({
    required this.enabled,
    required this.notificationSettings,
  });

  bool enabled;
  NotificationSettings notificationSettings;

  factory AthanSettings.defaultValue() => AthanSettings(
        enabled: false,
        notificationSettings: NotificationSettings(
          sound: true,
          vibration: false,
          ringtone: athanRingtones[0],
        ),
      );

  factory AthanSettings.fromJson(Map<String, dynamic> json) => AthanSettings(
        enabled: json["enabled"],
        notificationSettings:
            NotificationSettings.fromJson(json["notificationSettings"]),
      );

  Map<String, dynamic> toJson() => {
        "enabled": enabled,
        "notificationSettings": notificationSettings.toJson(),
      };
}

class IqamaSettings {
  IqamaSettings({
    required this.enabled,
    required this.notificationSettings,
    required this.delay,
  });
  bool enabled;
  NotificationSettings notificationSettings;
  int delay;

  factory IqamaSettings.fromJson(Map<String, dynamic> json) => IqamaSettings(
        enabled: json["enabled"],
        notificationSettings:
            NotificationSettings.fromJson(json["notificationSettings"]),
        delay: json["delay"],
      );

  Map<String, dynamic> toJson() => {
        "enabled": enabled,
        "notificationSettings": notificationSettings.toJson(),
        "delay": delay,
      };
}

class PrayerNotificationSettings {
  PrayerNotificationSettings({
    required this.athanSettings,
    required this.iqamaSettings,
    required this.preAthanSettings,
  });

  PrayerNotificationSettings.defaultValue()
      : this(
          athanSettings: AthanSettings(
              enabled: true,
              notificationSettings: NotificationSettings(
                sound: true,
                vibration: false,
                ringtone: athanRingtones[0],
              )),
          iqamaSettings: IqamaSettings(
            enabled: true,
            delay: 10,
            notificationSettings: NotificationSettings(
              sound: true,
              vibration: false,
              ringtone: iqamaRingtones[0],
            ),
          ),
          preAthanSettings: PreAthanSettings.defaultValue(),
        );

  AthanSettings athanSettings;
  IqamaSettings iqamaSettings;
  PreAthanSettings preAthanSettings;

  factory PrayerNotificationSettings.fromJson(Map<String, dynamic> json) {
    return PrayerNotificationSettings(
      athanSettings: AthanSettings.fromJson(json['athanSettings']),
      iqamaSettings: IqamaSettings.fromJson(json['iqamaSettings']),
      preAthanSettings: PreAthanSettings.fromJson(json['preAthanSettings']),
    );
  }
  Map<String, dynamic> toJson() => {
        'athanSettings': athanSettings.toJson(),
        'iqamaSettings': iqamaSettings.toJson(),
        'preAthanSettings': preAthanSettings.toJson()
      };
}

class NotificationSettings {
  NotificationSettings(
      {required this.sound, required this.vibration, required this.ringtone});

  bool sound;
  bool vibration;
  NotificationRingtone ringtone;

  factory NotificationSettings.fromJson(Map<String, dynamic> json) =>
      NotificationSettings(
        sound: json["sound"],
        vibration: json["vibration"],
        ringtone: NotificationRingtone(
          displayId: json["ringtoneId"],
          fileName: json["ringtoneFileName"],
        ),
      );

  Map<String, dynamic> toJson() => {
        "sound": sound,
        "vibration": vibration,
        "ringtoneId": ringtone.displayId,
        "ringtoneFileName": ringtone.fileName,
      };
}
