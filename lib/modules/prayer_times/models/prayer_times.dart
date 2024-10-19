import 'package:intl/intl.dart';
import 'package:nedaa/modules/settings/models/calculation_method.dart';
import 'package:nedaa/modules/settings/models/prayer_type.dart';
import 'package:nedaa/modules/settings/models/timing_type.dart';
import 'package:nedaa/utils/helper.dart';
import 'package:timezone/standalone.dart' as tz;

Map<String, String> _prayerTimesMapToJson(
    Map<PrayerType, DateTime> prayerTimes) {
  final Map<String, String> json = {};
  prayerTimes.forEach((key, value) {
    json[apiNames[key]!] = value.toIso8601String();
  });
  return json;
}

Map<PrayerType, DateTime> _prayerTimesMapFromJson(Map<String, dynamic> json) {
  final Map<PrayerType, DateTime> prayerTimes = {};
  apiNames.forEach((prayerType, prayerName) {
    prayerTimes[prayerType] = DateTime.parse(json[prayerName]!);
  });
  return prayerTimes;
}

Map<String, String> _otherTimesMapToJson(
    Map<TimingType, DateTime> otherTimings) {
  final Map<String, String> json = {};
  otherTimings.forEach((key, value) {
    json[apiTimingNames[key]!] = value.toIso8601String();
  });
  return json;
}

Map<TimingType, DateTime> _otherTimesMapFromJson(Map<String, dynamic> json) {
  final Map<TimingType, DateTime> otherTimings = {};
  apiTimingNames.forEach((timingType, timingName) {
    // Ensure the timingName exists in json and is not null before parsing
    if (json[timingName] != null) {
      otherTimings[timingType] = DateTime.parse(json[timingName]!);
    }
  });
  return otherTimings;
}

class DayPrayerTimes {
  final Map<PrayerType, DateTime> prayerTimes;
  final DateTime date;
  final CalculationMethod calculationMethod;
  final String timeZoneName;
  final Map<TimingType, DateTime> otherTimings;

  DayPrayerTimes(this.prayerTimes, this.timeZoneName, this.date,
      this.calculationMethod, this.otherTimings);

  factory DayPrayerTimes.fromAPIJson(Map<String, dynamic> json) {
    var prayerTimes = <PrayerType, DateTime>{};
    var otherTimings = <TimingType, DateTime>{};
    Map<String, dynamic> prayerTimesJson = json['timings'];
    apiNames.forEach((prayerType, prayerName) {
      prayerTimes[prayerType] =
          DateTime.parse(prayerTimesJson[prayerName].split(' ')[0]);
    });

    apiTimingNames.forEach((timingType, timingName) {
      otherTimings[timingType] =
          DateTime.parse(prayerTimesJson[timingName].split(' ')[0]);
    });

    var date =
        DateFormat('dd-MM-yyyy').parse(json['date']['gregorian']['date']);
    var calculationMethodId = json['meta']['method']['id'];
    var calculationMethod = CalculationMethod(calculationMethodId);
    var timezone = json['meta']['timezone'];

    return DayPrayerTimes(
        prayerTimes, timezone, date, calculationMethod, otherTimings);
  }

  factory DayPrayerTimes.fromJson(Map<String, dynamic> json) {
    var prayerTimes = _prayerTimesMapFromJson(json['prayerTimes']);
    Map<TimingType, DateTime> otherTimings = {};

    var date = DateTime.parse(json['date']);
    var calculationMethodId = json['calculationMethod'];
    var calculationMethod = CalculationMethod(calculationMethodId);
    var timezone = json['timezone'];

    // Safely handle potential null for otherTimings(For old user since we didn't save otherTimings before)
    if (json['otherTimings'] != null) {
      otherTimings = _otherTimesMapFromJson(json['otherTimings']);
    }

    return DayPrayerTimes(
        prayerTimes, timezone, date, calculationMethod, otherTimings);
  }

  // toJson
  Map<String, dynamic> toJson() {
    return {
      'prayerTimes': _prayerTimesMapToJson(prayerTimes),
      'date': date.toIso8601String(),
      'calculationMethod': calculationMethod.index,
      'timezone': timeZoneName,
      'otherTimings': _otherTimesMapToJson(otherTimings)
    };
  }
}

class PrayerTime {
  final DateTime time;
  final String timeZoneName;
  final PrayerType prayerType;

  PrayerTime(this.time, this.timeZoneName, this.prayerType);

  tz.TZDateTime get timezonedTime => getDateWithTimeZone(timeZoneName, time);
}

class OtherTiming {
  final DateTime time;
  final String timeZoneName;
  final TimingType timingType;

  OtherTiming(this.time, this.timeZoneName, this.timingType);

  tz.TZDateTime get timezonedTime => getDateWithTimeZone(timeZoneName, time);
}
