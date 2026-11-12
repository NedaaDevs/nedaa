import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

import { TAB_GROUP } from "@/constants/BackDestinations";
import { readRoutes, REPO_ROOT, ROUTES_DIR, walkFiles } from "@/test-helpers/routeTree";
import { isSkyRoute } from "@/utils/safeArea";

const DRAWS_SKY = /<ScreenSky\b/;
const COMPONENT_FILE = /\.[jt]sx$/;
const LAYOUT_FILE = /^_layout\.[jt]sx?$/;

const drawsSky = (path: string) => DRAWS_SKY.test(readFileSync(path, "utf8"));

const routes = readRoutes();
const skyFiles = routes.map(({ file }) => file).filter((file) => drawsSky(join(REPO_ROOT, file)));

/** Folders between the routes root and the file that hold a layout. */
const layoutsAbove = (file: string) => {
  const folders = relative(ROUTES_DIR, dirname(join(REPO_ROOT, file)))
    .split(sep)
    .filter(Boolean);
  return folders
    .map((_, index) => folders.slice(0, index + 1))
    .filter((parts) => parts.at(-1) !== TAB_GROUP)
    .filter((parts) =>
      readdirSync(join(ROUTES_DIR, ...parts)).some((name) => LAYOUT_FILE.test(name))
    )
    .map((parts) => parts.join("/"));
};

describe("sky routes", () => {
  it("leaves the top open for exactly the screens that draw the sky", () => {
    const open = routes.filter(({ name }) => isSkyRoute(name)).map(({ file }) => file);

    expect(open).toEqual(skyFiles);
  });

  // The check above reads route files only.
  it("draws the sky in route files only", () => {
    const elsewhere = walkFiles(join(REPO_ROOT, "src"))
      .filter((path) => COMPONENT_FILE.test(path))
      .filter((path) => !path.startsWith(`${ROUTES_DIR}${sep}`))
      .filter((path) => !path.split(sep).includes("__tests__"))
      .filter(drawsSky)
      .map((path) => relative(REPO_ROOT, path));

    expect(elsewhere).toEqual([]);
  });

  // A nested navigator reaches the root's wrapper under its own name only.
  it.each(skyFiles)("keeps %s out of any nested layout but the tabs'", (file) => {
    expect(layoutsAbove(file)).toEqual([]);
  });
});
