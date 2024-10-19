import 'dart:convert';
import 'package:geocoding/geocoding.dart';
import 'package:http/http.dart' as http;
import 'package:nedaa/constants/api_path.dart';
import 'package:nedaa/modules/prayer_times/models/prayer_times.dart';
import 'package:nedaa/modules/settings/models/calculation_method.dart';
import 'package:nedaa/utils/helper.dart';

Future<String> getTimezone(
    Location location, CalculationMethod calculationMethod) async {
  var response = await http.get(Uri.parse(
      '$getTimezoneUrl?${generateParams(location, calculationMethod, null, annual: false)}'));
  if (response.statusCode == 200) {
    Map<String, dynamic> map = json.decode(response.body);
    return map['timezone'];
  } else {
    return Future.error('An error occurred while getting timezone');
  }
}

List<DayPrayerTimes> _parseApiResponse(Map<String, dynamic> response) {
  if (response['code'] == 200 && response['data'] is Map<String, dynamic>) {
    var allDays =
        (response['data'] as Map<String, dynamic>).values.expand((month) {
      var m = month as List<dynamic>;
      return m.map((day) => DayPrayerTimes.fromAPIJson(day)).toList();
    }).toList();
    return allDays;
  }

  throw Exception('Failed to parse post');
}

Future<List<DayPrayerTimes>> getPrayerTimesForYear(
    Location location, CalculationMethod calculationMethod, String timezone,
    {int? year}) async {
  var response = await http.get(Uri.parse(
      '$getCalendarUrl?${generateParams(location, calculationMethod, year, annual: true, timezone: timezone)}'));
  if (response.statusCode == 200) {
    Map<String, dynamic> map = json.decode(response.body);
    return _parseApiResponse(map);
  } else {
    return Future.error('An error occurred while get prayer times');
  }
}

Future<http.Response> getCoordinatesFromAddress(String address) async {
  final response = await http.get(Uri.parse(
    '$getCoordinatesUrl?address=$address',
  ));

  if (response.statusCode == 200) {
    return response;
  } else {
    return Future.error('An error occurred while get coordinates');
  }
}
