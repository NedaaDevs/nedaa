import 'dart:convert';
import 'package:csc_picker/csc_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:geocoding/geocoding.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:nedaa/modules/settings/bloc/user_settings_bloc.dart';
import 'package:nedaa/modules/settings/models/user_location.dart';
import 'package:nedaa/utils/location_permission_utils.dart';
import 'package:nedaa/services/rest_api_service.dart';

class CurrentLocationPicker extends StatefulWidget {
  const CurrentLocationPicker({Key? key}) : super(key: key);

  @override
  State<CurrentLocationPicker> createState() => _CurrentLocationPickerState();
}

class _CurrentLocationPickerState extends State<CurrentLocationPicker> {
  String countryValue = "";
  String stateValue = "";
  String cityValue = "";

  Widget _getUserLocationString(UserLocation? location) {
    if (location != null &&
        location.cityAddress != null &&
        location.country != null) {
      return Text(
        "${location.cityAddress}, ${location.country}",
        style: Theme.of(context).textTheme.titleLarge,
      );
    } else {
      return Container();
    }
  }

  _updateUserLocation(
      BuildContext context, double latitude, double longitude) async {
    var userLocation =
        await updateUserLocation(context, latitude, longitude, () => mounted);
    setState(() {
      countryValue = userLocation.country!;
      stateValue = userLocation.state!;
      cityValue = userLocation.cityAddress!;
    });
  }

  _getCoordinatesFromAddress(BuildContext context) async {
    if ((cityValue.isNotEmpty || stateValue.isNotEmpty) &&
        countryValue.isNotEmpty) {
      var address = "$cityValue, $stateValue, $countryValue";
      try {
        Location location = await _geoCodingAddress();
        if (!mounted) return;
        _updateUserLocation(context, location.latitude, location.longitude);
        return;
      } catch (e) {
        debugPrint(e.toString());
      }

      var response = await getCoordinatesFromAddress(address);
      if (!mounted) return;

      var location = json.decode(response.body);
      _updateUserLocation(context, location['latitude'] as double,
          location['longitude'] as double);
    }
  }

  _geoCodingAddress() async {
    Location location =
        await locationFromAddress('$cityValue, $stateValue, $countryValue')
            .then((value) => value[0])
            .catchError((error) {
      throw Future.error(error);
    });
    return location;
  }

  @override
  Widget build(BuildContext context) {
    var t = AppLocalizations.of(context);

    var userSettings = context.watch<UserSettingsBloc>().state;
    var userLocation = userSettings.location;

    return Scaffold(
      appBar: AppBar(
        // change text style to match the app theme
        title: Text(t!.currentLocation),
      ),
      body: Padding(
        padding: const EdgeInsets.all(8.0),
        child: Column(children: [
          CSCPicker(
            // FIXME: find a better way to handle this. can't seem to find a way to control the bg color.
            selectedItemStyle: TextStyle(
                color: Theme.of(context).brightness == Brightness.dark
                    ? Colors.black
                    : Theme.of(context).textTheme.bodyLarge!.color),
            currentCity: userLocation.city,
            currentState: userLocation.state,
            currentCountry: userLocation.country,

            ///Enable disable state dropdown [OPTIONAL PARAMETER]
            showStates: true,

            /// Enable disable city drop down [OPTIONAL PARAMETER]
            showCities: true,

            ///Enable (get flag with country name) / Disable (Disable flag) / ShowInDropdownOnly (display flag in dropdown only) [OPTIONAL PARAMETER]
            flagState: CountryFlag.SHOW_IN_DROP_DOWN_ONLY,

            ///placeholders for dropdown search field
            countrySearchPlaceholder: t.country,
            stateSearchPlaceholder: t.state,
            citySearchPlaceholder: t.city,

            ///labels for dropdown
            countryDropdownLabel: t.country,
            stateDropdownLabel: t.state,
            cityDropdownLabel: t.city,

            ///Default Country
            //defaultCountry: DefaultCountry.India,

            ///Disable country dropdown (Note: use it with default country)
            //disableCountry: true,

            ///Dialog box radius [OPTIONAL PARAMETER]
            dropdownDialogRadius: 10.0,

            ///Search bar radius [OPTIONAL PARAMETER]
            searchBarRadius: 10.0,

            ///triggers once country selected in dropdown
            onCountryChanged: (value) {
              setState(() {
                ///store value in country variable
                countryValue = value;
                stateValue = "";
                cityValue = "";
              });
            },

            ///triggers once state selected in dropdown
            onStateChanged: (value) {
              if (value != null) {
                setState(() {
                  stateValue = value;
                  cityValue = "";
                  _getCoordinatesFromAddress(context);
                });
              }
            },

            ///triggers once city selected in dropdown
            onCityChanged: (value) {
              if (value != null) {
                setState(() {
                  cityValue = value;
                  _getCoordinatesFromAddress(context);
                });
              }
            },
          ),
          const Divider(),
          OverflowBar(
            alignment: MainAxisAlignment.center,
            children: [
              ElevatedButton(
                child: Text(t.getCurrentLocation),
                onPressed: () async {
                  await checkPermissionsUpdateCurrentLocation(
                      context, () => mounted);
                },
              ),
            ],
          ),
          _getUserLocationString(userLocation)
        ]),
      ),
    );
  }
}
