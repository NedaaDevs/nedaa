import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * The Expo Router tree, read from disk: a route is a file, so the filesystem is
 * the only authority on which paths exist. Shared, so the rules for groups,
 * index files and framework files are stated once.
 *
 * Outside `__tests__` because jest collects every file under there as a suite.
 */

export const REPO_ROOT = join(__dirname, "..", "..");
export const ROUTES_DIR = join(REPO_ROOT, "src", "app");

/** Generated, vendored or derived trees. Their contents are not the contract. */
export const SKIPPED_DIRECTORIES = new Set([
  "build",
  "Pods",
  "node_modules",
  ".gradle",
  ".cxx",
  "DerivedData",
  "xcuserdata",
]);

const escapeForRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const walkFiles = (directory: string): string[] => {
  const entries = readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) {
      return SKIPPED_DIRECTORIES.has(entry.name) ? [] : walkFiles(full);
    }
    return entry.isFile() ? [full] : [];
  });
};

const ROUTE_FILE = /\.(tsx|ts|jsx|js)$/;

/**
 * A route is any file that is not a layout (`_layout`), a framework file (`+…`)
 * or a declaration. A link landing only on `+not-found` is a broken link.
 */
const isRouteFile = (name: string) =>
  ROUTE_FILE.test(name) &&
  !name.endsWith(".d.ts") &&
  !/\.(test|spec)\.[jt]sx?$/.test(name) &&
  !name.startsWith("_") &&
  !name.startsWith("+");

/** Groups `(tabs)` vanish from the URL, a trailing `index` collapses, `.tsx` drops. */
const toRoutePath = (relativeFile: string) => {
  const segments = relativeFile
    .split(sep)
    .join("/")
    .replace(ROUTE_FILE, "")
    .split("/")
    .filter((segment) => !/^\(.*\)$/.test(segment));
  if (segments[segments.length - 1] === "index") segments.pop();
  return `/${segments.join("/")}`.replace(/\/$/, "") || "/";
};

/** `[id]` matches one segment, `[...rest]` matches the remainder. */
const toRouteMatcher = (routePath: string) =>
  new RegExp(
    `^${routePath
      .split("/")
      .map((segment) => {
        if (/^\[\.\.\..+\]$/.test(segment)) return ".*";
        if (/^\[.+\]$/.test(segment)) return "[^/]+";
        return escapeForRegExp(segment);
      })
      .join("/")}$`
  );

export type Route = { file: string; routePath: string; matcher: RegExp };

export const readRoutes = (): Route[] =>
  walkFiles(ROUTES_DIR)
    .filter((path) => isRouteFile(path.split(sep)[path.split(sep).length - 1]))
    .filter((path) => !path.split(sep).includes("__tests__"))
    .map((path) => {
      const file = relative(REPO_ROOT, path).split(sep).join("/");
      const routePath = toRoutePath(relative(ROUTES_DIR, path));
      return { file, routePath, matcher: toRouteMatcher(routePath) };
    });

/** `/(tabs)/athkar` and `/athkar` address the same file; query and trailing slash drop. */
export const normalizeRoutePath = (path: string) => {
  const withoutQuery = path.split(/[?#]/)[0];
  const segments = withoutQuery
    .split("/")
    .filter((segment) => segment !== "" && !/^\(.*\)$/.test(segment));
  return `/${segments.join("/")}`.replace(/\/$/, "") || "/";
};

export const resolvesToRoute = (routes: Route[], path: string): boolean =>
  routes.some((route) => route.matcher.test(normalizeRoutePath(path)));
