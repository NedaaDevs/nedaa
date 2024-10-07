import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';
import 'package:motion_toast/motion_toast.dart';
import 'package:nedaa/modules/prayer_times/bloc/prayer_times_bloc.dart';
import 'package:nedaa/modules/settings/bloc/user_settings_bloc.dart';
import 'package:nedaa/modules/settings/models/calculation_method.dart';
import 'package:nedaa/modules/settings/models/user_location.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:nedaa/services/rest_api_service.dart';
import 'package:nedaa/widgets/general_dialog.dart';

Future<bool> checkLocationServiceEnabled() async {
  return await Geolocator.isLocationServiceEnabled();
}

Future<bool> checkPermission(BuildContext context) async {
  LocationPermission permission = await Geolocator.checkPermission();
  switch (permission) {
    case LocationPermission.always:
    case LocationPermission.whileInUse:
      return true;
    case LocationPermission.denied:
      LocationPermission reqPermission = await Geolocator.requestPermission();
      if (reqPermission == LocationPermission.deniedForever ||
          reqPermission == LocationPermission.denied) return false;
      // managed to get permission
      return true;
    case LocationPermission.deniedForever:
      return false;
    case LocationPermission.unableToDetermine:
      // only supported in browsers, so we can't get here
      return false;
  }
}

Future<void> openAppSettings() async {
  await Geolocator.openAppSettings();
}

// TODO: use GlobalKey to access the context
checkPermissionsUpdateCurrentLocation(
    BuildContext context, bool Function() isMounted) async {
  var t = AppLocalizations.of(context);
  final key = GlobalKey();
  if (await checkLocationServiceEnabled() && await checkPermission(context)) {
    LocationSettings locationSettings = const LocationSettings(
      accuracy: LocationAccuracy.low,
    );
    Position position =
        await Geolocator.getCurrentPosition(locationSettings: locationSettings);
    var mounted = isMounted();
    if (!mounted) return;
    await updateUserLocation(
        context, position.latitude, position.longitude, isMounted);
  } else {
    var result = await customAlert(key.currentContext ?? context,
        t!.requestLocationPermissionTitle, t.requestLocationPermissionContent);

    var mounted = isMounted();
    if (!mounted) return;
    // Update user location with default location (Makkah)
    // setting the location here since the click open app settings
    // but not giving the permission
    await updateUserLocation(context, 21.422510, 39.826168, isMounted);

    if (!mounted) return;
    // if user pressed ok
    if (result) {
      openAppSettings();
    } else {
      //do taost here
      MotionToast(
        primaryColor: Theme.of(context).primaryColor,
        width: MediaQuery.of(context).size.width * 0.8,
        height: MediaQuery.of(context).size.height * 0.2,
        icon: Icons.info,
        position: MotionToastPosition.center,
        description: Text(
          t.instructionsToSetLocationManually,
          style: const TextStyle(color: Colors.black),
        ),
        toastDuration: const Duration(seconds: 10),
        dismissable: true,
      ).show(context);
    }
  }
}

Future<UserLocation> updateUserLocation(BuildContext context, double latitude,
    double longitude, bool Function() isMounted) async {
  var t = AppLocalizations.of(context);

  // Set the locale for the address translation
  setLocaleIdentifier(t?.localeName ?? 'en');
  List<Placemark> placemarks = await placemarkFromCoordinates(
    latitude,
    longitude,
  );
  Placemark placemark = placemarks[0];

  var userLocation = UserLocation(
    city: placemark.locality!,
    country: placemark.country!,
    state: placemark.administrativeArea!,
    location: Location(
      latitude: latitude,
      longitude: longitude,
      timestamp: DateTime.now(),
    ),
  );

  var mounted = isMounted();
  if (!mounted) return userLocation;
  var userSettingsBloc = context.read<UserSettingsBloc>();
  var userSettingsState = userSettingsBloc.state;
  var timezone = await getTimezone(
      userLocation.location!, userSettingsState.calculationMethod);

  mounted = isMounted();
  if (!mounted) return userLocation;

  var newCalculationMethod = CalculationMethod(-1);

  userSettingsBloc
    ..add(
      UserLocationEvent(userLocation, timezone),
    )
    ..add(CalculationMethodEvent(newCalculationMethod));

  context.read<PrayerTimesBloc>().add(
      CleanFetchPrayerTimesEvent(userLocation, newCalculationMethod, timezone));

  return userLocation;
}
