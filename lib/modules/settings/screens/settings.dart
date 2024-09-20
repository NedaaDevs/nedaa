import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:geocoding/geocoding.dart';
import 'package:nedaa/constants/app_constans.dart';
import 'package:nedaa/constants/calculation_methods.dart';
import 'package:nedaa/constants/theme_mode.dart';
import 'package:nedaa/main.dart';
import 'package:nedaa/modules/prayer_times/bloc/prayer_times_bloc.dart';
import 'package:nedaa/modules/settings/bloc/settings_bloc.dart';
import 'package:nedaa/modules/settings/bloc/user_settings_bloc.dart';
import 'package:nedaa/modules/settings/models/calculation_method.dart';
import 'package:nedaa/modules/settings/models/user_location.dart';
import 'package:nedaa/modules/settings/repositories/settings_repository.dart';
import 'package:nedaa/modules/settings/screens/location.dart';
import 'package:nedaa/modules/settings/screens/notification.dart';
import 'package:nedaa/utils/arabic_digits.dart';
import 'package:nedaa/utils/helper.dart';
import 'package:nedaa/widgets/general_dialog.dart';
import 'package:nedaa/widgets/options_dialog.dart';
import 'package:open_mail_app/open_mail_app.dart';
import 'package:settings_ui/settings_ui.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:url_launcher/url_launcher.dart';

class Settings extends StatefulWidget {
  const Settings({Key? key}) : super(key: key);

  @override
  State<Settings> createState() => _SettingsState();
}

class _SettingsState extends State<Settings> {
  bool lockInBackground = false;
  bool notificationsEnabled = false;
  bool sendCrashReports = true;
  static const email = 'support@nedaa.io';
  static const website = 'https://nedaa.io';

  _updateAddressTranslation(BuildContext context, Location currentUserLocation,
      String timezone, String language) async {
    // Set the locale for the address translation
    setLocaleIdentifier(language);
    Placemark placemark = await placemarkFromCoordinates(
      currentUserLocation.latitude,
      currentUserLocation.longitude,
    ).then((value) => value[0]);
    if (!mounted) return;

    context.read<UserSettingsBloc>().add(
          UserLocationEvent(
              UserLocation(
                location: currentUserLocation,
                city: placemark.locality,
                country: placemark.country,
                state: placemark.administrativeArea,
              ),
              timezone),
        );
  }

  @override
  Widget build(BuildContext context) {
    var t = AppLocalizations.of(context);
    var currentAppState = context.watch<SettingsBloc>().state;
    var stateLocale = currentAppState.appLanguage.languageCode;

    var currentLocale = supportedLocales[stateLocale] ?? supportedLocales['en'];
    var currentTheme = currentAppState.appTheme;

    var currentUserState = context.watch<UserSettingsBloc>().state;
    var currentCalculationMethod = currentUserState.calculationMethod;
    var locale = Localizations.localeOf(context);
    var methods =
        calculationMethods[locale.languageCode] ?? calculationMethods['en']!;

    var currentCalculationMethodName = methods[currentCalculationMethod.index];
    var currentUserCity = currentUserState.location.cityAddress;

    var currentUserLocation = currentUserState.location.location;
    var currentTimezone = currentUserState.timezone;

    var themeModesNames = themeModes[locale.languageCode] ?? themeModes['en']!;
    var currentThemeMode = themeModesNames[currentTheme]!;

    sendCrashReports = currentAppState.sendCrashReports;

    return SafeArea(
      child: Scaffold(
        extendBody: true,
        appBar: AppBar(
          title: Text(t!.appTitle),
          centerTitle: true,
        ),
        body: SettingsList(
          sections: [
            SettingsSection(
              title: Text(t.settings),
              tiles: [
                SettingsTile(
                  title: Text(t.language),
                  trailing: Text(currentLocale!),
                  leading: const Icon(Icons.language),
                  onPressed: (context) async {
                    final language = await showCupertinoDialog(
                      barrierDismissible: true,
                      context: context,
                      builder: (context) => OptionsDialog(
                        title: t.language,
                        entries: supportedLocales,
                      ),
                    );
                    if (!mounted) return;
                    if (language is String) {
                      context
                          .read<SettingsBloc>()
                          .add(LanguageEvent(Locale(language)));

                      var settingsRepo = context.read<SettingsRepository>();
                      var userLocation = settingsRepo.getUserLocation();
                      var calculationMethod =
                          settingsRepo.getCalculationMethod();
                      var timezone = settingsRepo.getTimezone();
                      context.read<PrayerTimesBloc>().add(FetchPrayerTimesEvent(
                          userLocation, calculationMethod, timezone));

                      // update address language
                      _updateAddressTranslation(context, currentUserLocation!,
                          currentTimezone, language);
                    }
                  },
                ),
                SettingsTile(
                  title: Text(t.theme),
                  trailing: Text(currentThemeMode),
                  leading: const Icon(Icons.color_lens),
                  onPressed: (context) async {
                    final themeMode = await showCupertinoDialog(
                      barrierDismissible: true,
                      context: context,
                      builder: (context) => OptionsDialog(
                          title: t.theme,
                          entries: themeModes[locale.languageCode] ??
                              themeModes['en']!),
                    );
                    if (!mounted) return;
                    if (themeMode is ThemeMode) {
                      context.read<SettingsBloc>().add(ThemeEvent(themeMode));
                    }
                  },
                ),
                SettingsTile(
                  title: Text(t.location),
                  trailing: Text(currentUserCity ?? ""),
                  leading: const Icon(Icons.room),
                  onPressed: (context) {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const LocationSettings(),
                      ),
                    );
                  },
                ),
                SettingsTile(
                  title: Text(t.notification),
                  leading: const Icon(Icons.notifications),
                  onPressed: (context) {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const NotificationScreen(),
                      ),
                    );
                  },
                ),
                SettingsTile(
                  title: Text(t.calculationMethod),
                  trailing: Text(currentCalculationMethodName!.length > 25
                      ? '${currentCalculationMethodName.substring(0, 25)}...'
                      : currentCalculationMethodName),
                  leading: const Icon(Icons.access_time_filled),
                  onPressed: (context) async {
                    final result = await showCupertinoDialog(
                      barrierDismissible: true,
                      context: context,
                      builder: (context) => OptionsDialog(
                        title: t.calculationMethod,
                        entries: calculationMethods[locale.languageCode] ??
                            calculationMethods['en']!,
                      ),
                    );
                    if (!mounted) return;
                    if (result is int) {
                      var calculationMethod = CalculationMethod(result);
                      var userSettingsBloc = context.read<UserSettingsBloc>();

                      userSettingsBloc
                          .add(CalculationMethodEvent(calculationMethod));

                      context.read<PrayerTimesBloc>().add(
                          CleanFetchPrayerTimesEvent(
                              userSettingsBloc.state.location,
                              calculationMethod,
                              userSettingsBloc.state.timezone));
                    }
                  },
                ),
              ],
            ),
            SettingsSection(
              title: Text(t.contactUs),
              tiles: [
                SettingsTile(
                  title: const Text(email),
                  leading: const Icon(Icons.email),
                  onPressed: (context) async {
                    // Use device info plugin to get device & package info
                    var deviceInfo = await getDeviceInfo();
                    var packageInfo = await getPackageInfo();

                    // append device & package info to email body at the end
                    var emailBody =
                        '\n\n Device Info: $deviceInfo\n$packageInfo';
                    debugPrint(emailBody);
                    EmailContent emailContent =
                        EmailContent(body: emailBody, to: [
                      email,
                    ]);
                    // Android: Will open mail app or show native picker.
                    // iOS: Will open mail app if single mail app found.
                    var result = await OpenMailApp.composeNewEmailInMailApp(
                      emailContent: emailContent,
                    );
                    if (!mounted) return;

                    // If no mail apps found, show error
                    if (!result.didOpen && !result.canOpen) {
                      showNoMailAppsDialog(context);

                      // iOS: if multiple mail apps found, show dialog to select.
                      // There is no native intent/default app system in iOS so
                      // you have to do it yourself.
                    } else if (!result.didOpen && result.canOpen) {
                      showDialog(
                        context: context,
                        builder: (_) {
                          return MailAppPickerDialog(
                            mailApps: result.options,
                            title: t.selectMailApp,
                            emailContent: emailContent,
                          );
                        },
                      );
                    }
                  },
                ),
                SettingsTile(
                  onPressed: (context) async {
                    final key = GlobalKey();
                    if (!await launchUrl(Uri.parse(website))) {
                      showDialog(
                        context: key.currentContext!,
                        builder: (_) {
                          return AlertDialog(
                            title: Text(t.error),
                            content: Text(t.unableToLunchLink),
                            actions: [
                              TextButton(
                                child: Text(t.ok),
                                onPressed: () => Navigator.of(context).pop(),
                              ),
                            ],
                          );
                        },
                      );
                    }
                  },
                  title: RichText(
                    text: const TextSpan(
                      text: website,
                      style: TextStyle(
                        color: Colors.blue,
                        decoration: TextDecoration.underline,
                      ),
                    ),
                  ),
                  leading: const Icon(Icons.public),
                ),
              ],
            ),
            // add app version at the end
            CustomSettingsSection(
              child: Center(
                  child: Text(
                '${t.appVersion}\n ${translateNumber(t, appVersion)}',
                textAlign: TextAlign.center,
              )),
            ),
            CustomSettingsSection(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  IconButton(
                    icon: const Icon(Icons.analytics),
                    onPressed: () {
                      showDialog(
                        context: context,
                        builder: (_) {
                          return AlertDialog(
                            title: Text(t.sendCrashReports),
                            content: Text(t.sendCrashReportsDescription),
                            actions: [
                              TextButton(
                                child: Text(t.ok),
                                onPressed: () => Navigator.of(context).pop(),
                              ),
                            ],
                          );
                        },
                      );
                    },
                  ),
                  Switch(
                    value: sendCrashReports,
                    onChanged: (value) {
                      setState(() {
                        sendCrashReports = value;
                      });
                      context
                          .read<SettingsBloc>()
                          .add(SendCrashReportsEvent(sendCrashReports));
                      // show restart dialog to apply changes
                      customAlert(
                          context, t.restart, t.restartAppToApplyChanges,
                          showOk: false, showCancel: false);
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

void showNoMailAppsDialog(BuildContext context) {
  showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text(""),
          content: Text(AppLocalizations.of(context)!.noMailAppFound),
          actions: <Widget>[
            TextButton(
              child: Text(AppLocalizations.of(context)!.ok),
              onPressed: () {
                Navigator.pop(context);
              },
            )
          ],
        );
      });
}
