/// <reference types="node" />
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

// `File`/`Directory.move()` and `.copy()` from expo-file-system return a Promise —
// the native side runs the relocation on a background dispatcher. Calling them
// without `await` lets the following statements run before the file has landed,
// which silently breaks any same-tick verification of the destination. The sync
// variants (`moveSync`/`copySync`) are the safe choice inside non-async helpers.

const SRC = join(__dirname, "..", "..");

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });

const CALL = /[\w)]\.(move|copy)\(/;
const SETTLED = /\b(await|return)\s+[^;]*\.(move|copy)\(/;
const COMMENT = /^\s*(\/\/|\*|\/\*)/;

describe("expo-file-system relocation calls", () => {
  it("are awaited or use the sync variant", () => {
    const offenders = sourceFiles(SRC)
      .map((file) => ({ file, source: readFileSync(file, "utf8") }))
      .filter(({ source }) => source.includes("expo-file-system"))
      .flatMap(({ file, source }) =>
        source
          .split("\n")
          .map((line, i) => ({ line: line.trim(), number: i + 1 }))
          .filter(({ line }) => !COMMENT.test(line) && CALL.test(line) && !SETTLED.test(line))
          .map(({ line, number }) => `${file.replace(SRC, "src")}:${number} — ${line}`)
      );

    expect(offenders).toEqual([]);
  });
});
