#!/usr/bin/env python3
"""Clean ayahs.text_normalized (the FTS search column) and rebuild ayahs_fts.

The bundled quran.db inherits text_normalized from the QUL/Tanzil source. Two
issues make verse search behave wrong, both fixed here (the display `text`
column is left untouched):

1. Stray tatweel (U+0640) in dagger-alef words (الرحمـن) blocks clean queries
   (الرحمن) from matching.
2. The basmala (بسم الله الرحمن الرحيم) is prepended to every surah's first ayah,
   so searches flood with ~112 surah-opener repetitions. Stripped from ayah 1 of
   every surah except Al-Fatiha (where it IS the ayah); At-Tawba has none.

One-off data migration: run against assets/db/quran.db. Re-apply after the
quran.db source is ever regenerated.
"""

import pathlib
import sqlite3

DB = pathlib.Path(__file__).resolve().parent.parent / "assets/db/quran.db"
TATWEEL = "char(0x640)"
BASMALA = "بسم الله الرحمن الرحيم"


def main() -> None:
    db = sqlite3.connect(DB)

    tatweel_n = db.execute(
        f"SELECT COUNT(*) FROM ayahs WHERE text_normalized LIKE '%'||{TATWEEL}||'%'"
    ).fetchone()[0]
    db.execute(
        f"UPDATE ayahs SET text_normalized = REPLACE(text_normalized, {TATWEEL}, '') "
        f"WHERE text_normalized LIKE '%'||{TATWEEL}||'%'"
    )

    prefix = BASMALA + " "
    to_strip = [
        (s, tn)
        for s, tn in db.execute(
            "SELECT surah_number, text_normalized FROM ayahs WHERE ayah_number = 1"
        ).fetchall()
        if s != 1 and tn.startswith(prefix)
    ]
    for surah, tn in to_strip:
        db.execute(
            "UPDATE ayahs SET text_normalized = ? WHERE surah_number = ? AND ayah_number = 1",
            (tn[len(prefix) :], surah),
        )

    db.execute("INSERT INTO ayahs_fts(ayahs_fts) VALUES('rebuild')")
    db.commit()
    db.execute("VACUUM")
    db.commit()
    print(f"stripped tatweel from {tatweel_n} rows; stripped basmala from {len(to_strip)} "
          "ayah-1 rows; rebuilt ayahs_fts")


if __name__ == "__main__":
    main()
