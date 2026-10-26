import { readFileSync } from "node:fs";
import { join } from "node:path";

import { REPO_ROOT } from "@/test-helpers/routeTree";

const read = (...path: string[]) => readFileSync(join(REPO_ROOT, ...path), "utf8");

/** Lets a notification marked time-sensitive ask to come through a Focus. */
const TIME_SENSITIVE = "com.apple.developer.usernotifications.time-sensitive";

const FROM_APP_JSON: Record<string, unknown> = JSON.parse(read("app.json")).expo.ios.entitlements;
const NATIVE = read("ios", "nedaa", "nedaa.entitlements");

// Without the entitlement iOS delivers the mark as an ordinary notification.
describe("Time Sensitive notifications", () => {
  it("are granted in app.json", () => {
    expect(FROM_APP_JSON[TIME_SENSITIVE]).toBe(true);
  });

  // ios/ is committed, so the native project carries what prebuild would write.
  it("are granted in the native project", () => {
    expect(NATIVE).toMatch(
      new RegExp(`<key>${TIME_SENSITIVE.replaceAll(".", "\\.")}</key>\\s*<true/>`)
    );
  });
});
