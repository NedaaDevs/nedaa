import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { TAB_BAR_PART } from "@/app/(tabs)/_layout";
import { FOCUS_COUNTDOWN_PART } from "@/components/today/FocusCountdown";
import { ALARM_DEBUG_TEST_SECONDS, E2E_ID, alarmDebugScheduleId } from "@/constants/E2E";
import { readRoutes, REPO_ROOT, resolvesToRoute } from "@/test-helpers/routeTree";

// Imported for their testIDs; these stand in for native modules they load.
jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@/components/athkar/MiniPlayerBar", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/quran/listen/QuranMiniPlayer", () => ({ QuranMiniPlayer: () => null }));

// Flows name testIDs and links as YAML strings; a rename fails here, not on CI.
const FLOWS_DIR = join(REPO_ROOT, ".maestro", "ci");
const APP_SCHEME = "myapp://";

const APP_TEST_IDS = new Set<string>([
  ...Object.values(E2E_ID),
  ...ALARM_DEBUG_TEST_SECONDS.map(alarmDebugScheduleId),
  TAB_BAR_PART.FRAME,
  FOCUS_COUNTDOWN_PART.ROW,
]);

// System views carry a package-qualified id; app testIDs never contain ':'.
const isSystemId = (id: string) => id.includes(":");

const flows = readdirSync(FLOWS_DIR)
  .filter((name) => name.endsWith(".yaml"))
  .map((name) => ({ name, text: readFileSync(join(FLOWS_DIR, name), "utf8") }));

const valuesOf = (key: string) =>
  flows.flatMap(({ name, text }) =>
    [...text.matchAll(new RegExp(`^\\s*-?\\s*${key}:\\s*"([^"]+)"`, "gm"))].map((match) => ({
      name,
      value: match[1],
    }))
  );

describe("CI Maestro flows", () => {
  it("finds the flows", () => {
    expect(flows.length).toBeGreaterThan(0);
  });

  it("matches only testIDs the app declares", () => {
    const unknown = valuesOf("id")
      .filter(({ value }) => !isSystemId(value) && !APP_TEST_IDS.has(value))
      .map(({ name, value }) => `${name}: ${value}`);
    expect(unknown).toEqual([]);
  });

  it("opens only links that resolve to a route", () => {
    const routes = readRoutes();
    const links = valuesOf("openLink");
    expect(links.length).toBeGreaterThan(0);
    const broken = links
      .filter(
        ({ value }) =>
          !value.startsWith(APP_SCHEME) ||
          !resolvesToRoute(routes, `/${value.slice(APP_SCHEME.length)}`)
      )
      .map(({ name, value }) => `${name}: ${value}`);
    expect(broken).toEqual([]);
  });
});
