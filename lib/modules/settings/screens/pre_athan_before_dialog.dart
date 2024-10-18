import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';

class PreAthanBeforeDialog extends StatefulWidget {
  const PreAthanBeforeDialog({Key? key, required this.before})
      : super(key: key);

  final int before;

  @override
  State<PreAthanBeforeDialog> createState() => _PreAthanBeforeDialogState();
}

class _PreAthanBeforeDialogState extends State<PreAthanBeforeDialog> {
  int _currentSliderValue = 0;

  @override
  void initState() {
    super.initState();
    _currentSliderValue = widget.before.clamp(1, 120);
  }

  @override
  Widget build(BuildContext context) {
    var t = AppLocalizations.of(context);
    return SimpleDialog(title: Text(t!.preAhtanBeforeTime), children: [
      Center(
          child: Text(
        _currentSliderValue.toInt().toString(),
      )),
      Slider(
        value: _currentSliderValue.toDouble(),
        min: 5,
        max: 130,
        label: _currentSliderValue.toInt().toString(),
        onChanged: (double value) {
          setState(() {
            _currentSliderValue = value.toInt();
          });
        },
      ),
      Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          TextButton(
            onPressed: () {
              Navigator.pop(context, _currentSliderValue);
            },
            child: Text(t.ok),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context, null);
            },
            child: Text(t.cancel),
          ),
        ],
      ),
    ]);
  }
}
