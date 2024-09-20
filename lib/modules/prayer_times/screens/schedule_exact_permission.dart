import 'package:flutter/material.dart';
import 'package:nedaa/utils/helper.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';

class ScheduleExactPermission extends StatefulWidget {
  const ScheduleExactPermission({Key? key}) : super(key: key);

  @override
  State<ScheduleExactPermission> createState() =>
      _ScheduleExactPermissionState();
}

class _ScheduleExactPermissionState extends State<ScheduleExactPermission> {
  bool _isPermissionGranted = false;

  @override
  void initState() {
    super.initState();
    _checkPermissionStatus();
  }

  Future<void> _checkPermissionStatus() async {
    final status = await Permission.scheduleExactAlarm.status;
    setState(() {
      _isPermissionGranted = status.isGranted;
    });
  }

  @override
  Widget build(BuildContext context) {
    var t = AppLocalizations.of(context)!;
    return SafeArea(
      child: Scaffold(
        extendBody: true,
        appBar: AppBar(
          title: Text(t.appTitle),
          centerTitle: true,
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              children: [
                Expanded(
                  child: Center(
                    child: _isPermissionGranted
                        ? Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.check_circle,
                                  color: Colors.green),
                              const SizedBox(width: 8),
                              Text(t.permissionGranted),
                              Text(t.reAddTheWidget)
                            ],
                          )
                        : Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              ElevatedButton.icon(
                                icon: const Icon(Icons.alarm),
                                label: Text(t.requestPermission),
                                onPressed: () async {
                                  var status = await Permission
                                      .scheduleExactAlarm
                                      .onGrantedCallback(() async {
                                    await updateAndroidWidgets();
                                  }).request();
                                  if (status.isGranted) {
                                    setState(() {
                                      _isPermissionGranted = true;
                                    });
                                  }
                                },
                              ),
                              const SizedBox(height: 16),
                              Text(
                                t.scheduleExactAlarmDescription,
                                textAlign: TextAlign.center,
                              ),
                            ],
                          ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
