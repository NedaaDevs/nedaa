import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:home_widget/home_widget.dart';
import 'package:nedaa/modules/prayer_times/bloc/prayer_times_bloc.dart';
import 'package:nedaa/modules/prayer_times/screens/schedule_exact_permission.dart';
import 'package:nedaa/modules/settings/bloc/settings_bloc.dart';
import 'package:nedaa/modules/settings/bloc/user_settings_bloc.dart';
import 'package:nedaa/modules/settings/repositories/settings_repository.dart';
import 'package:nedaa/modules/settings/screens/settings.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import '../modules/prayer_times/screens/prayer_times.dart';

import 'package:nedaa/utils/location_permission_utils.dart';

class MainScreen extends StatefulWidget {
  const MainScreen({Key? key}) : super(key: key);

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _checkForWidgetLaunch();
    HomeWidget.widgetClicked.listen(_launchedFromWidget);
  }

  void _checkForWidgetLaunch() {
    HomeWidget.initiallyLaunchedFromHomeWidget().then(_launchedFromWidget);
  }

  void _launchedFromWidget(Uri? uri) {
    if (uri != null && uri.host == "requestpermission") {
      Navigator.push(
        context,
        MaterialPageRoute(
            builder: (context) => const ScheduleExactPermission()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    var t = AppLocalizations.of(context);

    var settingsBloc = context.watch<SettingsBloc>();

    if (settingsBloc.state.isFirstRun) {
      checkPermissionsUpdateCurrentLocation(context, () => mounted);
      settingsBloc.add(FirstRunEvent());
    }
    return Align(
      alignment: Alignment.topLeft,
      child: SafeArea(
        top: false,
        bottom: false,
        child: Scaffold(
          extendBody: true,
          appBar: AppBar(
            title: Text(t!.appTitle),
            actions: [
              IconButton(
                icon: const Icon(Icons.settings),
                onPressed: () async {
                  await Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => const Settings(),
                      ));

                  if (!mounted) {
                    return;
                  }
                  // Fire a prayer fetch event, so that we can reschedule
                  // notifications in case the user gave notifications permission
                  // in the settings.
                  var settingsRepo = context.read<SettingsRepository>();
                  var userLocation = settingsRepo.getUserLocation();
                  var calculationMethod = settingsRepo.getCalculationMethod();
                  var timezone = settingsRepo.getTimezone();
                  context.read<PrayerTimesBloc>().add(FetchPrayerTimesEvent(
                      userLocation, calculationMethod, timezone));
                },
              )
            ],
            centerTitle: true,
          ),
          body: Container(
            decoration: const BoxDecoration(
              image: DecorationImage(
                image: AssetImage("assets/images/logo.png"),
                fit: BoxFit.fitWidth,
                opacity: 0.2,
              ),
            ),
            child: BlocBuilder<SettingsBloc, SettingsState>(
              builder: (context, state) {
                // render only if we have a location
                var currentUserState = context.watch<UserSettingsBloc>().state;
                if (currentUserState.location.location == null) {
                  return const Center(
                    // TODO: show error message to add a location
                    child: CircularProgressIndicator(),
                  );
                }
                return const PrayerTimes();
              },
            ),
          ),
        ),
      ),
    );
  }
}
// glance-action:/CALLBACK?appWidgetId=81&viewId=5&viewSize=89.90476.dp%20x%2089.90476.dp&extraData=
