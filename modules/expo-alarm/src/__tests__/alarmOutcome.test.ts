import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ALARM_OUTCOME } from "../index";

// The Android JVM test AlarmOutcomeTest reads the same table.
const FIXTURE = join(__dirname, "..", "..", "fixtures", "alarm-outcome.tsv");

const shared = Object.fromEntries(
  readFileSync(FIXTURE, "utf8")
    .split("\n")
    .slice(1)
    .filter((line) => line.length > 0)
    .map((line) => line.split("\t"))
);

describe("ALARM_OUTCOME", () => {
  it("is the table the Android overlay writes", () => {
    expect({ ...ALARM_OUTCOME }).toEqual(shared);
  });
});
