import { BACK_DESTINATION } from "@/constants/BackDestinations";
import {
  backDestination,
  type NavigatorRoute,
  type NavigatorState,
} from "@/components/ui/screen-header/backDestination";

// Shapes copied from expo-router 57 under renderRouter: an outer container
// holding the root layout, the app stack, then any nested layout.
const route = (name: string, state?: NavigatorState): NavigatorRoute => ({
  key: `${name}-key`,
  name,
  state,
});

const stack = (
  key: string,
  routes: NavigatorRoute[],
  index = routes.length - 1
): NavigatorState => ({
  key,
  type: "stack",
  index,
  routes,
});

const tabs = (routes: NavigatorRoute[], focused: number): NavigatorState => ({
  key: "tabs",
  type: "tab",
  index: focused,
  routes,
  // React Navigation's default back behaviour keeps the first tab behind any other.
  history: [...new Set([0, focused])].map((i) => ({ type: "route", key: routes[i].key })),
});

const home = route("index");
const tools = route("tools");
const settingsTab = route("settings");

const container = (app: NavigatorState) => stack("container", [route("__root", app)]);

describe("backDestination", () => {
  it("names the previous screen in the same stack", () => {
    const alarm = route("settings/alarm");
    const debug = route("settings/alarm-debug");
    const app = stack("app", [route("(tabs)", tabs([home, tools], 1)), alarm, debug]);

    expect(backDestination([app, container(app)], debug.key)).toBe(
      BACK_DESTINATION.SETTINGS_ALARM.route
    );
  });

  it("descends into the tab that was showing", () => {
    const alarm = route("settings/alarm");
    const app = stack("app", [route("(tabs)", tabs([home, tools], 1)), alarm]);

    expect(backDestination([app, container(app)], alarm.key)).toBe(BACK_DESTINATION.TOOLS.route);
  });

  // The holder route of a freshly mounted stack carries no state yet.
  it("climbs out of a nested stack whose first screen is showing", () => {
    const ihram = route("ihram");
    const prepare = stack("prepare", [ihram]);
    const umrah = stack("umrah", [route("index"), route("prepare")]);
    const app = stack("app", [route("(tabs)", tabs([home, tools], 1)), route("umrah", umrah)]);

    expect(backDestination([prepare, umrah, app, container(app)], ihram.key)).toBe(
      BACK_DESTINATION.UMRAH.route
    );
  });

  // Two nested layouts: the path must read outermost first, as the file tree does.
  it("names a screen behind in a doubly nested stack from the root down", () => {
    const ihram = route("ihram");
    const prepare = stack("prepare", [route("index"), ihram]);
    const umrah = stack("umrah", [route("index"), route("prepare", prepare)]);
    const app = stack("app", [route("(tabs)", tabs([home, tools], 1)), route("umrah", umrah)]);

    expect(backDestination([prepare, umrah, app, container(app)], ihram.key)).toBe(
      BACK_DESTINATION.UMRAH_PREPARE.route
    );
  });

  it("follows tab history rather than tab order", () => {
    const tabState = tabs([home, tools, settingsTab], 2);
    const app = stack("app", [route("(tabs)", tabState)]);

    expect(backDestination([tabState, app, container(app)], settingsTab.key)).toBe(
      BACK_DESTINATION.HOME.route
    );
  });

  it("finds nothing behind the first tab", () => {
    const tabState = tabs([home, tools], 0);
    const app = stack("app", [route("(tabs)", tabState)]);

    expect(backDestination([tabState, app, container(app)], home.key)).toBeUndefined();
  });

  it("finds nothing behind a screen opened cold", () => {
    const alarm = route("settings/alarm");
    const app = stack("app", [alarm]);

    expect(backDestination([app, container(app)], alarm.key)).toBeUndefined();
  });
});
