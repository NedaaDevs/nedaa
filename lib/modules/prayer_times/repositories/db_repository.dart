import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:nedaa/constants/app_constans.dart';
import 'package:nedaa/modules/prayer_times/models/prayer_times.dart';
import 'package:nedaa/utils/helper.dart';
import 'package:path_provider/path_provider.dart';
import 'package:sqflite/sqflite.dart';

import 'package:path/path.dart' as p;

const String dbName = 'nedaa.db';

const int kVersion1 = 1;

const String columnDate = 'date';
const String columnContent = 'content';

const String prayerTimesTable = 'PrayerTimes';

int _dateToInt(DateTime date) =>
    date.year * 10000 + date.month * 100 + date.day;

class DBDayPrayerTimes {
  int date;
  String content;

  DBDayPrayerTimes(DayPrayerTimes prayerTimes)
      : date = _dateToInt(prayerTimes.date),
        content = json.encode(prayerTimes.toJson());

  Map<String, Object?> toMap() {
    return {
      columnDate: date,
      columnContent: content,
    };
  }

  DBDayPrayerTimes.fromMap(Map<String, Object?> map)
      : date = map[columnDate] as int,
        content = map[columnContent] as String;
}

class DBRepository {
  Database? db;

  Future<String> getAppGroupDirectory() async {
    if (Platform.isIOS) {
      final dir = await getApplicationSupportDirectory();
      return p.join(dir.path, appGroupId);
    }
    throw UnsupportedError('This function is only supported on iOS');
  }

  Future<void> open() async {
    var databasesPath = await getDatabasesPath();
    String oldPath = p.join(databasesPath, dbName);

    // On iOS, we need to store the database in app group directory
    // so that it can be accessed by the app extension
    if (Platform.isIOS) {
      databasesPath = await getAppGroupDirectory();

      String newPath = p.join(databasesPath, dbName);

      // for old users, the database is stored in the old location
      if (await databaseExists(oldPath)) {
        // Copy the database to the new location
        await copyDatabase(oldPath, newPath);
        // Delete the old database
        await deleteDatabase(oldPath);
      }

      db = await openDatabase(newPath, version: kVersion1,
          onCreate: (Database db, int version) async {
        _createDb(db);
      });
    } else {
      db = await openDatabase(oldPath, version: kVersion1,
          onCreate: (Database db, int version) async {
        _createDb(db);
      });
    }
  }

  Future<void> copyDatabase(String sourcePath, String destinationPath) async {
    final File sourceFile = File(sourcePath);
    await sourceFile.copy(destinationPath);
  }

  static Future _createDb(Database db) async {
    await db.execute('DROP TABLE If EXISTS $prayerTimesTable');
    await db.execute(
        'CREATE TABLE $prayerTimesTable($columnDate INTEGER PRIMARY KEY, $columnContent TEXT)');
  }

  Future<DayPrayerTimes?> getDayPrayerTimes(DateTime date) async {
    final int dateInt = _dateToInt(date);

    final List<Map<String, Object?>> maps = await db!.query(
      prayerTimesTable,
      where: '$columnDate = ?',
      whereArgs: [dateInt],
    );
    if (maps.isEmpty) {
      return null;
    }
    return DayPrayerTimes.fromJson(
        json.decode(maps.first[columnContent] as String));
  }

  Future<List<DayPrayerTimes>> getAllPrayerTimes() async {
    List<Map<String, Object?>> maps = await db!.query(prayerTimesTable);

    return List.generate(maps.length, (i) {
      return DayPrayerTimes.fromJson(
          json.decode(maps[i][columnContent] as String));
    });
  }

  Future<List<int>> getAllDates() async {
    List<Map<String, Object?>> maps = await db!.query(prayerTimesTable);

    return List.generate(maps.length, (i) {
      return maps[i][columnDate] as int;
    });
  }

  Future<List<DayPrayerTimes>> getRangePrayerTimes(
      DateTime startDate, DateTime endDate) async {
    List<Map<String, Object?>> maps = await db!.query(
      prayerTimesTable,
      where: '$columnDate BETWEEN ? AND ?',
      whereArgs: [_dateToInt(startDate), _dateToInt(endDate)],
    );
    return List.generate(maps.length, (i) {
      return DayPrayerTimes.fromJson(
        json.decode(maps[i][columnContent] as String),
      );
    });
  }

  Future insertPrayerTimes(DayPrayerTimes prayerTimes) async {
    if (db != null) {
      await _savePrayerTimes(db!, DBDayPrayerTimes(prayerTimes));
    }
  }

  Future insertAllPrayerTimes(List<DayPrayerTimes> prayerTimes) async {
    if (db != null) {
      await db!.transaction((txn) async {
        for (DayPrayerTimes prayerTime in prayerTimes) {
          await _savePrayerTimes(txn, DBDayPrayerTimes(prayerTime));
        }

        await _updateWidgets();
      });
    }
  }

  /// Add a prayer time
  static Future _savePrayerTimes(
      DatabaseExecutor db, DBDayPrayerTimes updatePrayerTimes) async {
    await db.insert(prayerTimesTable, updatePrayerTimes.toMap(),
        conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<void> resetDatabase() async {
    await _deleteDatabase();
    await open();
  }

  Future<void> deleteAll() async {
    if (db != null) {
      await db?.delete(prayerTimesTable);
    }
  }

  Future<void> _deleteDatabase() async {
    if (db != null) {
      await deleteDatabase(db!.path);
    }
  }

  Future<void> deleteAllBefore(DateTime date) async {
    var dateInt = _dateToInt(date);
    if (db != null) {
      await db!.delete(
        prayerTimesTable,
        where: '$columnDate < ?',
        whereArgs: [dateInt],
      );
    }
  }

  Future<void> close() async {
    if (db != null) {
      await db!.close();
    }
  }

// Updates the widget after fetching prayer times
  Future _updateWidgets() async {
    try {
      Platform.isIOS ? await updateiOSWidgets() : await updateAndroidWidgets();
    } catch (e) {
      debugPrint(e.toString());
    }
  }
}
