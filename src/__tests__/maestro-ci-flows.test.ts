import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { TAB_BAR_PART } from "@/app/(tabs)/_layout";
import { FOCUS_COUNTDOWN_PART } from "@/components/today/FocusCountdown";
import { ALARM_DEBUG_TEST_SECONDS, E2E_ID, alarmDebugScheduleId } from "@/constants/E2E";
import { ONBOARDING_PART } from "@/constants/Onboarding";
import { AppLocale } from "@/enums/app";
import ar from "@/localization/locales/ar.json";
import en from "@/localization/locales/en.json";
import { HAND_WRITTEN_LOCALES, LOCALE_BUNDLES } from "@/test-helpers/locales";
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
  ...Object.values(ONBOARDING_PART),
  ...ALARM_DEBUG_TEST_SECONDS.map(alarmDebugScheduleId),
  TAB_BAR_PART.FRAME,
  FOCUS_COUNTDOWN_PART.ROW,
]);

// System views carry a package-qualified id; app testIDs never contain ':'.
const isSystemId = (id: string) => id.includes(":");

type Flow = { name: string; text: string };

const flows: Flow[] = readdirSync(FLOWS_DIR)
  .filter((name) => name.endsWith(".yaml"))
  .map((name) => ({ name, text: readFileSync(join(FLOWS_DIR, name), "utf8") }));

const readScript = (name: string) => readFileSync(join(REPO_ROOT, "scripts", "ci", name), "utf8");
const CHECK_SCRIPT = readScript("android-emulator-check.sh");
const CHECK_LINES = CHECK_SCRIPT.split("\n");
const LIB_SCRIPT = readScript("emulator-lib.sh");
const VISUAL_SCRIPT = readScript("visual-check.sh");

// A run_flow call, not its definition, with the flow's name when it is static.
const RUN_FLOW_CALL = /(?:^|[\s;&|(])run_flow\b(?!\s*\(\))(?:\s+(["']?)([\w-]+)\1(?=[\s;)]|$))?/g;

/** A script's statically named flows, and its run_flow calls with no name. */
const runFlowCalls = (script: string) => {
  const calls = script
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .flatMap((line) =>
      [...line.matchAll(RUN_FLOW_CALL)].map((match) => ({ line, name: match[2] }))
    );
  return {
    names: calls.flatMap(({ name }) => (name === undefined ? [] : [name])),
    unnamed: calls.filter(({ name }) => name === undefined).map(({ line }) => line),
  };
};
/** The flows a script copies out of `$flows` to run them. */
const copiedFlows = (script: string) =>
  [...script.matchAll(/\$flows\/([\w-]+)\.yaml/g)].map((match) => match[1]);

const RUN_FLOW = runFlowCalls(CHECK_SCRIPT);
const ciFlowNames = [...new Set([...RUN_FLOW.names, ...copiedFlows(VISUAL_SCRIPT)])];
const ciFlows = flows.filter(({ name }) => ciFlowNames.includes(name.replace(/\.yaml$/, "")));

// A templated value is filled per shot; visual-check.test.ts checks those.
const isTemplate = (value: string) => value.includes("${");

// A YAML scalar: double-quoted, single-quoted or bare, before any comment.
const SCALAR = String.raw`(?:"([^"]*)"|'([^']*)'|([^\s#'"][^#\n]*?))[ \t]*(?:#.*)?$`;

const valuesOf = (from: Flow[], key: string) =>
  from
    .flatMap(({ name, text }) =>
      [...text.matchAll(new RegExp(`^[ \t]*-?[ \t]*${key}:[ \t]*${SCALAR}`, "gm"))].map(
        (match) => ({ name, value: match[1] ?? match[2] ?? match[3] })
      )
    )
    .filter(({ value }) => !isTemplate(value));

// Commands whose bare value is a text selector.
const TEXT_SHORTHANDS = ["tapOn", "longPressOn", "doubleTapOn"] as const;
const textsOf = (from: Flow[]) => [
  ...valuesOf(from, "text"),
  ...TEXT_SHORTHANDS.flatMap((command) => valuesOf(from, command)),
];
/** Maestro's match: a full-match regex, case-insensitive, `.` across lines. */
const matchesSelector = (selector: string, target: string) => {
  try {
    return new RegExp(`^(?:${selector})$`, "is").test(target);
  } catch {
    return selector.toLowerCase() === target.toLowerCase();
  }
};

const TURN_ON_KEY = "onboarding.alarm.turnOn";
const turnOnLabel = (locale: AppLocale) => LOCALE_BUNDLES[locale][TURN_ON_KEY];
// A Crowdin locale without the label yet shows the English one.
const TURN_ON_LABELS = Object.values(AppLocale)
  .map(turnOnLabel)
  .filter((label): label is string => typeof label === "string");

/** Each selector in `from` that reaches the alarm step's turn-on button. */
const turnOnTaps = (from: Flow[]) => [
  ...valuesOf(from, "id").filter(({ value }) =>
    matchesSelector(value, ONBOARDING_PART.ALARM_TURN_ON)
  ),
  ...textsOf(from).filter(({ value }) =>
    TURN_ON_LABELS.some((label) => matchesSelector(value, label))
  ),
];

// Flow-style values and block scalars hide selectors from the line reader.
const UNREADABLE = /^[ \t]*-?[ \t]*(?:[\w]+:[ \t]*)?(?:[{[]|[|>][-+0-9]*[ \t]*(?:#.*)?$)/;
const unreadableLines = (from: Flow[]) =>
  from.flatMap(({ name, text }) =>
    text
      .split("\n")
      .map((line, at) => ({ line, at }))
      .filter(({ line }) => !/^\s*#/.test(line) && UNREADABLE.test(line))
      .map(({ line, at }) => `${name}:${at + 1}: ${line.trim()}`)
  );

describe("CI Maestro flows", () => {
  it("finds the flows, and each flow CI runs", () => {
    expect(flows.length).toBeGreaterThan(0);
    expect(RUN_FLOW.names.length).toBeGreaterThan(0);
    expect(ciFlowNames).toContain("visual");
    expect(
      ciFlowNames.filter((name) => !flows.some((flow) => flow.name === `${name}.yaml`))
    ).toEqual([]);
  });

  // A flow named at run time would leave the guards without saying so.
  it("names each flow the emulator check runs in the script itself", () => {
    expect(RUN_FLOW.unnamed).toEqual([]);
  });

  it("reads run_flow calls indented or quoted, and reports one with no static name", () => {
    const sample = [
      "run_flow() {",
      "run_flow onboarding",
      "# run_flow skipped",
      "if true; then",
      "  run_flow alarm-enable",
      "fi",
      'run_flow "smoke" -e "APP_ID=$APP_ID"',
      'for flow in a b; do run_flow "$flow"; done',
    ].join("\n");
    expect(runFlowCalls(sample)).toEqual({
      names: ["onboarding", "alarm-enable", "smoke"],
      unnamed: ['for flow in a b; do run_flow "$flow"; done'],
    });
  });

  it("reads double-quoted, single-quoted and bare values, and the tapOn shorthand", () => {
    const sample: Flow = {
      name: "sample.yaml",
      text: [
        '- tapOn: "Quoted"',
        "- tapOn: 'Single' # a note",
        "- tapOn: Bare words",
        "- tapOn:",
        "    id: bare-id",
        "    text: '${TEMPLATE}'",
      ].join("\n"),
    };
    expect(valuesOf([sample], "tapOn").map(({ value }) => value)).toEqual([
      "Quoted",
      "Single",
      "Bare words",
    ]);
    expect(valuesOf([sample], "id").map(({ value }) => value)).toEqual(["bare-id"]);
    expect(valuesOf([sample], "text")).toEqual([]);
  });

  it("reads the turn-on label of each locale written in the repo", () => {
    expect(HAND_WRITTEN_LOCALES.map(turnOnLabel)).toEqual(
      HAND_WRITTEN_LOCALES.map(() => expect.stringMatching(/\S/))
    );
  });

  // Maestro reads ids and text as case-insensitive, full-match regexes.
  it("finds a turn-on tap however Maestro would reach it", () => {
    const sample: Flow = {
      name: "sample.yaml",
      text: [
        `- tapOn: "${en[TURN_ON_KEY].toLowerCase()}"`,
        "- longPressOn: Turn on.*",
        "- doubleTapOn: TURN ON THE ALARM",
        "- tapOn:",
        "    id: onboarding-alarm-turn-.*",
        "- tapOn:",
        `    text: ${ar[TURN_ON_KEY]}`,
        "- tapOn:",
        "    id: onboarding-alarm-later",
      ].join("\n"),
    };
    expect(turnOnTaps([sample])).toHaveLength(5);
  });

  it("flags flow-style values and block scalars, which it cannot read", () => {
    const sample: Flow = {
      name: "sample.yaml",
      text: [
        "- tapOn: { id: onboarding-alarm-turn-on }",
        "- tapOn: >-",
        "    Turn on the alarm",
        "- assertVisible: [a]",
        "- tapOn:",
        '    id: "onboarding-continue"',
        "# - tapOn: { id: x }",
        '- openLink: "myapp://a?b={c}"',
      ].join("\n"),
    };
    expect(unreadableLines([sample])).toEqual([
      "sample.yaml:1: - tapOn: { id: onboarding-alarm-turn-on }",
      "sample.yaml:2: - tapOn: >-",
      "sample.yaml:4: - assertVisible: [a]",
    ]);
  });

  // An install with -g grants every prompt the deny flow must decline.
  it("runs the deny flow on an install that grants nothing, with its app id", () => {
    const run = CHECK_LINES.findIndex((line) =>
      /^\s*run_flow\s+["']?onboarding-denied\b/.test(line)
    );
    expect(run).toBeGreaterThan(-1);
    expect(CHECK_LINES[run]).toMatch(/-e "?APP_ID=\$APP_ID"?/);
    const install = CHECK_LINES.slice(0, run).findLast((line) => /^\s*install_fresh\b/.test(line));
    expect(install).toMatch(/^\s*install_fresh\s+\S+\s+\S+\s+none\b/);
  });

  it("installs with no permission granted when install_fresh is told none", () => {
    const none = LIB_SCRIPT.match(
      /\[\s*"\$grants"\s*=\s*"?none"?\s*\]\s*;\s*then\n([\s\S]*?)\n\s*(?:else|fi)\b/
    )?.[1];
    expect(none).toMatch(/\badb install\b/);
    expect(none).not.toMatch(/\s-g\b/);
  });

  it("matches only testIDs the app declares", () => {
    const unknown = valuesOf(flows, "id")
      .filter(({ value }) => !isSystemId(value) && !APP_TEST_IDS.has(value))
      .map(({ name, value }) => `${name}: ${value}`);
    expect(unknown).toEqual([]);
  });

  // Turning an alarm on opens system screens that no CI device can answer.
  it("never turns an onboarding alarm on in a flow CI runs", () => {
    expect(turnOnTaps(ciFlows).map(({ name, value }) => `${name}: ${value}`)).toEqual([]);
  });

  it("writes every selector in a CI flow in block style, which the guards read", () => {
    expect(unreadableLines(ciFlows)).toEqual([]);
  });

  it("opens only links that resolve to a route", () => {
    const routes = readRoutes();
    const links = valuesOf(flows, "openLink");
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
