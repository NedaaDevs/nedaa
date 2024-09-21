import 'package:flutter/material.dart';
import 'package:home_widget/home_widget.dart';
import 'package:nedaa/constants/app_constans.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'dart:io' show Platform;

class WidgetPinSection extends StatefulWidget {
  const WidgetPinSection({Key? key}) : super(key: key);

  @override
  WidgetPinSectionState createState() => WidgetPinSectionState();
}

class WidgetPinSectionState extends State<WidgetPinSection> {
  bool _isSupported = false;

  @override
  void initState() {
    super.initState();
    _checkSupport();
  }

  Future<void> _checkSupport() async {
    if (Platform.isAndroid) {
      bool isSupported =
          await HomeWidget.isRequestPinWidgetSupported() ?? false;
      setState(() {
        _isSupported = isSupported;
      });
    }
  }

  void _showWidgetOptions(BuildContext context) {
    var t = AppLocalizations.of(context)!;
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: Text(
            t.selectWidget,
            style: Theme.of(context).textTheme.titleSmall,
          ),
          content: SingleChildScrollView(
            child: ListBody(
              children: androidWidgetNames.map((widgetName) {
                return ListTile(
                  leading: Icon(_getWidgetIcon(widgetName)),
                  title: Text(_getWidgetDisplayName(context, widgetName)),
                  onTap: () {
                    Navigator.of(context).pop();
                    _pinWidget(widgetName);
                  },
                );
              }).toList(),
            ),
          ),
        );
      },
    );
  }

  IconData _getWidgetIcon(String widgetName) {
    switch (widgetName) {
      case 'NedaaWidgetReceiver':
        return Icons.watch_later_rounded;
      case 'AllPrayersWidgetReceiver':
        return Icons.calendar_today_rounded;
      default:
        return Icons.widgets;
    }
  }

  String _getWidgetDisplayName(BuildContext context, String widgetName) {
    var t = AppLocalizations.of(context)!;
    switch (widgetName) {
      case 'NedaaWidgetReceiver':
        return t.nedaaWidget;
      case 'AllPrayersWidgetReceiver':
        return t.allPrayersWidget;
      default:
        return t.unknownWidget;
    }
  }

  Future<void> _pinWidget(String widgetName) async {
    var t = AppLocalizations.of(context)!;
    try {
      await HomeWidget.requestPinWidget(
        name: widgetName,
        androidName: widgetName,
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(t.failedToPinWidget(e.toString()))),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    var t = AppLocalizations.of(context)!;
    if (!Platform.isAndroid || !_isSupported) {
      return const SizedBox.shrink();
    }

    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            t.pinWidget,
            style: Theme.of(context).textTheme.titleSmall,
          ),
          const SizedBox(height: 14),
          ElevatedButton.icon(
            icon: const Icon(Icons.add_to_home_screen),
            label: Text(t.addToHomeScreen),
            onPressed: () => _showWidgetOptions(context),
          ),
        ],
      ),
    );
  }
}
