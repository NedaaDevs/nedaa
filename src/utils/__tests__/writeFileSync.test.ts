/// <reference types="node" />
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { REPO_ROOT, walkFiles } from "@/test-helpers/routeTree";
import { writeFileSync } from "@/utils/writeFileSync";

type Content = Parameters<typeof writeFileSync>[1];

type SyncFile = { content?: Content; write: (content: Content) => void };

// expo-file-system 57: `write` is synchronous and `writeSync` does not exist.
const syncWriteFile = () => {
  const file: SyncFile = {
    write: (content) => {
      file.content = content;
    },
  };
  return file;
};

type AsyncFile = {
  content?: Content;
  write: (content: Content) => Promise<void>;
  writeSync: (content: Content) => void;
};

// expo-file-system 58: `write` lands after the caller moves on.
const asyncWriteFile = () => {
  const file: AsyncFile = {
    write: async (content) => {
      await Promise.resolve();
      file.content = content;
    },
    writeSync: (content) => {
      file.content = content;
    },
  };
  return file;
};

describe("writeFileSync", () => {
  it("lands the content before returning when the file has writeSync", () => {
    const file = asyncWriteFile();

    writeFileSync(file, "sentinel");

    expect(file.content).toBe("sentinel");
  });

  it("lands the content before returning when write itself blocks", () => {
    const file = syncWriteFile();
    const bytes = new Uint8Array([1, 2, 3]);

    writeFileSync(file, bytes);

    expect(file.content).toBe(bytes);
  });
});

const HELPER = join(REPO_ROOT, "src", "utils", "writeFileSync.ts");
const SCANNED = [join(REPO_ROOT, "src"), join(REPO_ROOT, "modules")];
const SOURCE = /\.tsx?$/;
const CALL = /\.write\(/;
const COMMENT = /^\s*(\/\/|\*|\/\*)/;

describe("expo-file-system writes", () => {
  it("go through writeFileSync, so none races the step after it", () => {
    const offenders = SCANNED.flatMap(walkFiles)
      .filter((file) => SOURCE.test(file) && file !== HELPER)
      .map((file) => ({ file, source: readFileSync(file, "utf8") }))
      .flatMap(({ file, source }) =>
        source
          .split("\n")
          .map((line, i) => ({ line: line.trim(), number: i + 1 }))
          .filter(({ line }) => !COMMENT.test(line) && CALL.test(line))
          .map(({ line, number }) => `${relative(REPO_ROOT, file)}:${number} — ${line}`)
      );

    expect(offenders).toEqual([]);
  });
});
