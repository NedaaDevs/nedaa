import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_native_splash/flutter_native_splash.dart';
import 'package:home_widget/home_widget.dart';
import 'package:nedaa/constants/app_constans.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:nedaa/constants/theme.dart';
import 'package:nedaa/modules/notifications/notifications.dart';
import 'package:nedaa/modules/prayer_times/bloc/prayer_times_bloc.dart';
import 'package:nedaa/modules/prayer_times/repositories/prayer_times_repository.dart';
import 'package:nedaa/modules/settings/bloc/settings_bloc.dart';
import 'package:nedaa/modules/settings/bloc/user_settings_bloc.dart';
import 'package:nedaa/modules/settings/models/calculation_method.dart';
import 'package:nedaa/modules/settings/models/user_location.dart';
import 'package:nedaa/modules/settings/repositories/settings_repository.dart';
import 'package:nedaa/screens/main_screen.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sentry_flutter/sentry_flutter.dart';
import 'package:timezone/data/latest_all.dart' as tz_init;
import 'package:workmanager/workmanager.dart';

const taskId = 'io.nedaa.schedule';
String appVersion = "";

@pragma('vm:entry-point')
void callbackDispatcher() {
  Workmanager().executeTask((task, inputData) async {
    try {
      if (task == taskId && Platform.isAndroid) {
        debugPrint('android task $task');
        await _task();
      } else if (task == Workmanager.iOSBackgroundTask) {
        debugPrint('iOSBackgroundTask $task');
        await _task();
      }
    } catch (e) {
      debugPrint(e.toString());
      return Future.value(false);
    }
    return Future.value(true);
  });
}

Future<bool> _task() async {
  // use sendCrashReports to determine if you want to send crash reports or not.
  SettingsRepository settingsRepository = SettingsRepository(
    await SharedPreferences.getInstance(),
  );
  var sendCrashReports = settingsRepository.getSendCrashReports();

  if (sendCrashReports) {
    await SentryFlutter.init((options) {
      options.dsn = const String.fromEnvironment('SENTRY_DSN');
      // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
      // We recommend adjusting this value in production.
      options.tracesSampleRate = 0.3;
      options.sampleRate = 0.3;
      options.enableAutoPerformanceTracing = true;
      options.autoAppStart = true;
      options.enableAppLifecycleBreadcrumbs = true;
    }, appRunner: () async {
      await _backgroundRescheduleNotification();
    });
  } else {
    await _backgroundRescheduleNotification();
  }
  return Future.value(true);
}

Future<void> _backgroundRescheduleNotification() async {
  initNotifications();

  tz_init.initializeTimeZones();
  SettingsRepository settingsRepository = SettingsRepository(
    await SharedPreferences.getInstance(),
  );

  var location = settingsRepository.getUserLocation();
  var method = settingsRepository.getCalculationMethod();
  var timezone = settingsRepository.getTimezone();

  var prayerTimesRepository =
      await PrayerTimesRepository.newRepo(location, method, timezone);
  var prayerTimesState = await prayerTimesRepository.getCurrentPrayerTimesState(
      location, method, timezone);

  var lang = settingsRepository.getLanguage();

  var t = await AppLocalizations.delegate.load(lang);
  await scheduleNotificationsInner(t,
      settingsRepository.getNotificationSettings(), prayerTimesState.tenDays);
}

void main() async {
  final startTime = DateTime.now().millisecondsSinceEpoch;

  WidgetsBinding widgetsBinding = WidgetsFlutterBinding.ensureInitialized();
  FlutterNativeSplash.preserve(widgetsBinding: widgetsBinding);

  initNotifications();

  PackageInfo packageInfo = await PackageInfo.fromPlatform();
  appVersion = packageInfo.version;

  Workmanager().initialize(
      callbackDispatcher, // The top level function, aka callbackDispatcher
      isInDebugMode:
          false // If enabled it will post a notification whenever the task is running. Handy for debugging tasks
      );
  await Workmanager().cancelAll();
  if (Platform.isAndroid) {
    Workmanager().registerPeriodicTask(
      taskId,
      taskId,
      frequency: const Duration(days: 2),
    );
  }

  // Wait 0.5 seconds before removing the splash screen
  await Future.delayed(const Duration(milliseconds: 500));

  tz_init.initializeTimeZones();

  SettingsRepository settingsRepository = SettingsRepository(
    await SharedPreferences.getInstance(),
  );

  UserLocation location = settingsRepository.getUserLocation();
  CalculationMethod method = settingsRepository.getCalculationMethod();
  String timezone = settingsRepository.getTimezone();
  PrayerTimesRepository prayerTimesRepository =
      await PrayerTimesRepository.newRepo(location, method, timezone);
  var sendCrashReports = settingsRepository.getSendCrashReports();

  final totalTime = DateTime.now().millisecondsSinceEpoch - startTime;

  // If previous commands took less than the minimum splash time,
  // then wait the remaining time.
  final delayTime = minimumSplashScreenTime - totalTime;
  if (delayTime > 0) {
    await Future.delayed(Duration(milliseconds: delayTime));
  }

  FlutterNativeSplash.remove();

  debugPrint(
      "Splash time: ${DateTime.now().millisecondsSinceEpoch - startTime}ms");

  HomeWidget.setAppGroupId(appGroupId);
  SystemChrome.setPreferredOrientations(
      [DeviceOrientation.portraitUp, DeviceOrientation.portraitDown]);
  if (sendCrashReports) {
    await SentryFlutter.init((options) {
      options.dsn = const String.fromEnvironment('SENTRY_DSN');
      // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
      // We recommend adjusting this value in production.
      options.tracesSampleRate = 0.3;
      options.sampleRate = 0.3;
      options.enableAutoPerformanceTracing = true;
      options.autoAppStart = true;
      options.enableAppLifecycleBreadcrumbs = true;
    }, appRunner: () async {
      runApp(
        MyApp(
          settingsRepository: settingsRepository,
          prayerTimesRepository: prayerTimesRepository,
        ),
      );
    });
  } else {
    runApp(
      MyApp(
        settingsRepository: settingsRepository,
        prayerTimesRepository: prayerTimesRepository,
      ),
    );
  }
}

class MyApp extends StatelessWidget {
  const MyApp(
      {Key? key,
      required this.settingsRepository,
      required this.prayerTimesRepository})
      : super(key: key);
  final SettingsRepository settingsRepository;
  final PrayerTimesRepository prayerTimesRepository;

  @override
  Widget build(BuildContext context) {
    return MultiRepositoryProvider(
      providers: [
        RepositoryProvider.value(value: settingsRepository),
        RepositoryProvider.value(value: prayerTimesRepository)
      ],
      child: MultiBlocProvider(
        providers: [
          BlocProvider(
              create: (context) =>
                  SettingsBloc(context.read<SettingsRepository>())),
          BlocProvider(
            create: (context) =>
                UserSettingsBloc(context.read<SettingsRepository>()),
          ),
          BlocProvider(
            create: (context) {
              var settingsRepo = context.read<SettingsRepository>();
              var userLocation = settingsRepo.getUserLocation();
              var calculationMethod = settingsRepo.getCalculationMethod();
              var timezone = settingsRepo.getTimezone();
              return PrayerTimesBloc(context.read<PrayerTimesRepository>())
                ..add(FetchPrayerTimesEvent(
                    userLocation, calculationMethod, timezone))
                // this listens to all updates in prayer times and sets
                // calculation method to the default value we got from the API
                // if it is not set yet
                ..stream.forEach((state) async {
                  if (state.todayPrayerTimes != null) {
                    var userSettingsBloc = context.read<UserSettingsBloc>();
                    var oldCalculationMethod =
                        userSettingsBloc.state.calculationMethod;
                    if (oldCalculationMethod.index == -1) {
                      userSettingsBloc.add(
                        CalculationMethodEvent(
                          state.todayPrayerTimes!.calculationMethod,
                        ),
                      );
                    }
                  }

                  try {
                    await scheduleNotifications(
                      context,
                      state.tenDaysPrayerTimes,
                    );
                  } catch (e, trace) {
                    debugPrint(e.toString());
                    debugPrintStack(stackTrace: trace);
                  }
                });
            },
          ),
        ],
        child: BlocBuilder<SettingsBloc, SettingsState>(
          builder: (BuildContext context, SettingsState settingsState) {
            var fontFamily = context.read<SettingsBloc>().state.font;
            return MaterialApp(
              navigatorObservers: [SentryNavigatorObserver()],
              onGenerateTitle: (context) {
                Locale activeLocale = Localizations.localeOf(context);
                debugPrint(
                    'Current locale => ${activeLocale.languageCode}'); // en/ar
                debugPrint(activeLocale
                    .countryCode); // => UK or empty for non-country-specific locales
                return AppLocalizations.of(context)!.appTitle;
              },
              locale: settingsState.appLanguage,
              localizationsDelegates: const [
                AppLocalizations.delegate,
                GlobalMaterialLocalizations.delegate,
                GlobalWidgetsLocalizations.delegate,
                GlobalCupertinoLocalizations.delegate,
              ],
              supportedLocales: supportedLocales.keys.map((e) => Locale(e, '')),
              theme: CustomTheme.light.copyWith(
                textTheme: ThemeData().textTheme.apply(fontFamily: fontFamily),
              ),
              darkTheme: CustomTheme.dark.copyWith(
                textTheme: ThemeData().textTheme.apply(
                    fontFamily: fontFamily,
                    bodyColor:
                        Theme.of(context).primaryTextTheme.bodyLarge?.color),
              ),
              themeMode: settingsState.appTheme,
              initialRoute: '/',
              routes: {
                '/': (context) => const MainScreen(),
              },
            );
          },
        ),
      ),
    );
  }
}
