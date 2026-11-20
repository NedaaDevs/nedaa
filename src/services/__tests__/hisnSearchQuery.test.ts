import { hisnMatchQuery } from "@/services/hisn-muslim-db";

type MockDatabase = {
  exec: (sql: string) => void;
  prepare: (sql: string) => { all: (...params: unknown[]) => { rowid: number }[] };
};
const { DatabaseSync } = jest.requireActual<{
  DatabaseSync: new (path: string) => MockDatabase;
}>("node:sqlite");

// The bundled table's columns and tokenizer, on Node's SQLite.
const db = new DatabaseSync(":memory:");
db.exec(`CREATE VIRTUAL TABLE athkar_fts USING fts5(
  arabic_text, translation, category_title_ar, category_title_en, tokenize='unicode61'
)`);
const ROWS = [
  { rowid: 1, arabic: "سبحان الله", english: 'Say "Glory be to Allah"' },
  { rowid: 2, arabic: "الحمد لله", english: "Praise be to Allah" },
];
for (const { rowid, arabic, english } of ROWS) {
  db.prepare(
    "INSERT INTO athkar_fts (rowid, arabic_text, translation, category_title_ar, category_title_en) VALUES (?, ?, ?, '', '')"
  ).all(rowid, arabic, english);
}

const matches = (query: string) =>
  db
    .prepare("SELECT rowid FROM athkar_fts WHERE athkar_fts MATCH ? ORDER BY rowid")
    .all(hisnMatchQuery(query))
    .map(({ rowid }) => rowid);

describe("hisnMatchQuery on FTS5", () => {
  it.each(['"', 'glo"ry', '"glory', 'سبحان"', '"" ""'])(
    "reads %s without a syntax error",
    (query) => {
      expect(() => matches(query)).not.toThrow();
    }
  );

  it("finds a row by a word typed with a quote", () => {
    expect(matches('"glory')).toEqual([1]);
  });

  it("finds each word by its start, vowels ignored", () => {
    expect(matches("سُبْحَ")).toEqual([1]);
    expect(matches("prai all")).toEqual([2]);
  });
});
