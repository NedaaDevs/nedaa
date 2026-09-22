import { readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { readRoutes, walkFiles, REPO_ROOT } from "@/test-helpers/routeTree";

/**
 * Pins the deep-link contract between the native layers and the Expo Router tree.
 *
 * Swift widgets and Kotlin alarm code hardcode their navigation targets as string
 * literals. No JavaScript change can reach those strings, so renaming or moving a
 * route file under src/app breaks widgets and alarms with no error on either side.
 *
 * Every input is read from disk when the test runs — the native sources, app.json,
 * both native manifests and the route tree — so a rename on either side fails here
 * instead of on a device.
 */

/** Native trees that hold hardcoded link literals. */
const NATIVE_ROOTS = ["ios", "android", "modules"];

const NATIVE_SOURCE_FILE = /\.(swift|kt|java|m|mm|h)$/;

/**
 * Transport and platform schemes. They address the network, a bundled resource or
 * a ContentProvider, never the app's router, so they carry no route obligation.
 */
const PLATFORM_SCHEMES = new Set(["http", "https", "file", "data", "content", "android.resource"]);

const SchemeKind = {
  /** Opens the app. Whatever follows the scheme must resolve to a route file. */
  NAVIGABLE: "navigable",
  /** Distinguishes one PendingIntent from another. Nothing ever resolves it. */
  INTENT_DISCRIMINATOR: "intent-discriminator",
} as const;

type SchemeKindValue = (typeof SchemeKind)[keyof typeof SchemeKind];

/**
 * Schemes the native code uses that `expo.scheme` in app.json does not declare.
 * Each entry records why the scheme still works. The tests below re-verify those
 * reasons against the tree rather than accepting them, so an entry here suppresses
 * nothing: it only moves the proof to a different assertion.
 */
const UNDECLARED_SCHEMES: Record<string, { kind: SchemeKindValue; reason: string }> = {
  "dev.nedaa.app": {
    kind: SchemeKind.NAVIGABLE,
    reason:
      "The iOS bundle identifier. @expo/config-plugins appends ios.bundleIdentifier to CFBundleURLTypes on every prebuild, so iOS gets it for free. Android does not: android.package is dev.nedaa.android, and the Android scheme plugin only appends schemes it finds in the config, so this one lives solely in the committed AndroidManifest.xml. It is asserted against both native manifests below.",
  },
  nedaa: {
    kind: SchemeKind.INTENT_DISCRIMINATOR,
    reason:
      "Not a link. It is the `data` URI on explicit Intents aimed at AlarmReceiver and AthanReceiver. Intent.filterEquals() compares action, data, type, component and categories but ignores extras, so the per-alarm URI is what keeps each alarm's PendingIntent distinct under FLAG_UPDATE_CURRENT. No Activity, intent-filter or route resolves it.",
  },
};

type NativeLink = {
  /** Repo-relative path, for the failure message. */
  file: string;
  line: number;
  scheme: string;
  /** The literal as written, Swift string interpolation included. */
  raw: string;
};

/** Matches `scheme://rest` and stops at the closing quote or whitespace. */
const LINK_LITERAL = /([A-Za-z][A-Za-z0-9+.-]*):\/\/[^"'\s`]*/g;

const readNativeLinks = (): NativeLink[] =>
  NATIVE_ROOTS.flatMap((root) =>
    walkFiles(join(REPO_ROOT, root))
      .filter((path) => NATIVE_SOURCE_FILE.test(path))
      .flatMap((path) => {
        const source = readFileSync(path, "utf8");
        return [...source.matchAll(LINK_LITERAL)]
          .filter((match) => !PLATFORM_SCHEMES.has(match[1]))
          .map((match) => ({
            file: relative(REPO_ROOT, path).split(sep).join("/"),
            line: source.slice(0, match.index).split("\n").length,
            scheme: match[1],
            raw: match[0],
          }));
      })
  );

/**
 * A custom scheme has no authority component that Expo Router cares about: the
 * linking layer strips `scheme://` and treats the remainder, host included, as the
 * path. `dev.nedaa.app://alarm` and `myapp:///alarm` therefore both address `/alarm`.
 */
const toLinkPath = (raw: string) => {
  const afterScheme = raw.slice(raw.indexOf("://") + 3);
  const path = afterScheme.split(/[?#]/)[0].replace(/^\/+/, "").replace(/\/+$/, "");
  return `/${path}`.replace(/\/$/, "") || "/";
};

const readDeclaredSchemes = () => {
  const { expo } = JSON.parse(readFileSync(join(REPO_ROOT, "app.json"), "utf8"));
  const collect = (value: unknown) => {
    if (typeof value === "string") return [value];
    if (Array.isArray(value))
      return value.filter((entry): entry is string => typeof entry === "string");
    return [];
  };
  return new Set([
    ...collect(expo.scheme),
    ...collect(expo.ios?.scheme),
    ...collect(expo.android?.scheme),
  ]);
};

/** Every scheme in a CFBundleURLSchemes array across the iOS targets. */
const readInfoPlistSchemes = () =>
  new Set(
    walkFiles(join(REPO_ROOT, "ios"))
      .filter((path) => path.endsWith("Info.plist"))
      .flatMap((path) => {
        const plist = readFileSync(path, "utf8");
        const arrays = plist.matchAll(
          /<key>CFBundleURLSchemes<\/key>\s*<array>([\s\S]*?)<\/array>/g
        );
        return [...arrays].flatMap((array) =>
          [...array[1].matchAll(/<string>(.*?)<\/string>/g)].map((entry) => entry[1].trim())
        );
      })
  );

/**
 * Schemes on MainActivity's intent filters only. A scheme under `<queries>` declares
 * what the app may look up, not what it can be opened with.
 */
const readManifestSchemes = () => {
  const manifest = readFileSync(
    join(REPO_ROOT, "android", "app", "src", "main", "AndroidManifest.xml"),
    "utf8"
  );
  const mainActivity = manifest.match(
    /<activity[^>]*android:name="\.MainActivity"[\s\S]*?<\/activity>/
  );
  if (!mainActivity)
    throw new Error("MainActivity not found in android/app/src/main/AndroidManifest.xml");
  return new Set([...mainActivity[0].matchAll(/android:scheme="(.*?)"/g)].map((entry) => entry[1]));
};

const describeLink = (link: NativeLink) => `${link.file}:${link.line}  ${link.raw}`;

const nativeLinks = readNativeLinks();
const routes = readRoutes();
const usedSchemes = [...new Set(nativeLinks.map((link) => link.scheme))].sort();

const kindOf = (scheme: string) => UNDECLARED_SCHEMES[scheme]?.kind ?? SchemeKind.NAVIGABLE;

describe("native deep-link contract", () => {
  it("finds the native link literals and the route tree", () => {
    // Guards the scanners themselves: a regex or a moved directory that silently
    // matches nothing would make every other assertion here pass vacuously.
    expect(nativeLinks.length).toBeGreaterThan(20);
    expect(routes.length).toBeGreaterThan(20);
    expect(usedSchemes).toContain("myapp");
  });

  it("resolves every navigable native link to a registered route", () => {
    const failures = nativeLinks
      .filter((link) => kindOf(link.scheme) === SchemeKind.NAVIGABLE)
      .flatMap((link) => {
        const linkPath = toLinkPath(link.raw);
        const match = routes.find((route) => route.matcher.test(linkPath));
        if (match) return [];
        return [
          [
            `Broken deep link at ${describeLink(link)}`,
            `  resolves to route path : ${linkPath}`,
            `  no route file matches it under src/app`,
            `  fix: restore the route, e.g. src/app${linkPath === "/" ? "/(tabs)/index.tsx" : `${linkPath}.tsx`} or src/app/(group)${linkPath}.tsx,`,
            `       or update the literal in ${link.file} to the route that replaced it.`,
          ].join("\n"),
        ];
      });

    expect(failures.join("\n\n")).toBe("");
  });

  it("keeps every used scheme declared, or documented with a verified reason", () => {
    const declared = readDeclaredSchemes();
    const failures = usedSchemes
      .filter((scheme) => !declared.has(scheme) && !UNDECLARED_SCHEMES[scheme])
      .map((scheme) => {
        const sites = nativeLinks.filter((link) => link.scheme === scheme).map(describeLink);
        return [
          `Undeclared scheme "${scheme}" used by native code:`,
          ...sites.map((site) => `  ${site}`),
          `  fix: add "${scheme}" to expo.scheme in app.json, or add it to UNDECLARED_SCHEMES`,
          `       in this file with the reason it does not need declaring.`,
        ].join("\n");
      });

    expect(failures.join("\n\n")).toBe("");
  });

  it("declares every navigable undeclared scheme in both native manifests", () => {
    // app.json cannot vouch for these, so the native manifests have to. On Android the
    // scheme plugin appends but never prunes, which means `expo prebuild --clean`
    // regenerates the manifest from app.json alone and drops anything missing there.
    const plistSchemes = readInfoPlistSchemes();
    const manifestSchemes = readManifestSchemes();
    const failures = usedSchemes
      .filter((scheme) => UNDECLARED_SCHEMES[scheme]?.kind === SchemeKind.NAVIGABLE)
      .flatMap((scheme) => {
        const sites = nativeLinks.filter((link) => link.scheme === scheme).map(describeLink);
        const missing = [
          plistSchemes.has(scheme) ? null : "ios/**/Info.plist (CFBundleURLSchemes)",
          manifestSchemes.has(scheme)
            ? null
            : "android/app/src/main/AndroidManifest.xml (MainActivity intent-filter)",
        ].filter((entry): entry is string => entry !== null);
        if (missing.length === 0) return [];
        return [
          [
            `Scheme "${scheme}" opens the app but is not declared in:`,
            ...missing.map((entry) => `  ${entry}`),
            `  used by:`,
            ...sites.map((site) => `    ${site}`),
            `  reason it is absent from app.json: ${UNDECLARED_SCHEMES[scheme].reason}`,
          ].join("\n"),
        ];
      });

    expect(failures.join("\n\n")).toBe("");
  });

  it("keeps the intent-discriminator schemes off the router", () => {
    // Proves the UNDECLARED_SCHEMES reason instead of trusting it: each of these URIs
    // must sit on an explicit Intent aimed at a receiver class and must not be an
    // ACTION_VIEW intent. Turning one into a real link has to fail here, because it
    // would then need a declared scheme and a route.
    const failures = nativeLinks
      .filter((link) => kindOf(link.scheme) === SchemeKind.INTENT_DISCRIMINATOR)
      .flatMap((link) => {
        const source = readFileSync(join(REPO_ROOT, link.file), "utf8").split("\n");
        const window = source.slice(Math.max(0, link.line - 13), link.line).join("\n");
        const lastIntent = window.lastIndexOf("Intent(");
        const construction = lastIntent === -1 ? "" : window.slice(lastIntent);
        const isExplicit =
          /^Intent\(\s*[A-Za-z_][\w.]*\s*,\s*[A-Za-z_][\w.]*::class\.java\s*\)/.test(construction);
        const isViewIntent = /ACTION_VIEW/.test(window);
        if (isExplicit && !isViewIntent) return [];
        return [
          [
            `${describeLink(link)} is treated as a PendingIntent discriminator, but the`,
            `  Intent around it is ${isViewIntent ? "an ACTION_VIEW intent" : "not an explicit receiver Intent"}.`,
            `  If this URI now opens the app it must be declared in app.json and resolve to a route;`,
            `  move "${link.scheme}" out of UNDECLARED_SCHEMES or restore the explicit Intent.`,
          ].join("\n"),
        ];
      });

    expect(failures.join("\n\n")).toBe("");
  });
});
