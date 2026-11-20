import { readFileSync } from "node:fs";
import { join } from "node:path";

import { AndroidConfig, XML } from "@expo/config-plugins";

import { REPO_ROOT } from "@/test-helpers/routeTree";

// RN measures text by advances; a TextView targeting API 35+ breaks lines by
// ink bounds unless its style says otherwise, so Arabic words split or clip.
const STYLES = join(REPO_ROOT, "android", "app", "src", "main", "res", "values", "styles.xml");
const PLUGIN = "./plugins/withTextViewBoundsForWidth";

const { getAppThemeGroup, getStylesGroupAsObject } = AndroidConfig.Styles;

// The plugin is CommonJS, loaded by the path app.json registers.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { applyTextViewBounds } = require(join(REPO_ROOT, PLUGIN));

type StylesXML = Parameters<typeof getStylesGroupAsObject>[0];

const committedStyles = () => XML.parseXMLAsync(readFileSync(STYLES, "utf8")) as Promise<StylesXML>;

/** The style the theme hands every TextView, resolved by name. */
const textViewStyle = (xml: StylesXML) => {
  const reference = getStylesGroupAsObject(xml, getAppThemeGroup())?.["android:textViewStyle"];
  const name = reference?.replace(/^@style\//, "");
  return name ? xml.resources.style?.find((style) => style.$.name === name) : undefined;
};

const itemCount = (xml: StylesXML) =>
  (xml.resources.style ?? []).reduce((sum, style) => sum + (style.item?.length ?? 0), 0);

describe("Android text view bounds", () => {
  it("gives every TextView useBoundsForWidth=false through the app theme", async () => {
    const style = textViewStyle(await committedStyles());

    expect(style?.$.parent).toBe("Widget.AppCompat.TextView");
    const items = Object.fromEntries((style?.item ?? []).map((item) => [item.$.name, item._]));
    expect(items["android:useBoundsForWidth"]).toBe("false");
  });

  it("registers the config plugin so prebuild keeps the style", () => {
    const app = JSON.parse(readFileSync(join(REPO_ROOT, "app.json"), "utf8"));

    expect(app.expo.plugins).toContain(PLUGIN);
  });

  it("leaves the committed styles unchanged when the plugin runs twice", async () => {
    const committed = await committedStyles();
    const once = applyTextViewBounds(structuredClone(committed));
    const twice = applyTextViewBounds(structuredClone(once));

    expect(itemCount(twice)).toBe(itemCount(committed));
    expect(XML.format(twice)).toBe(XML.format(committed));
  });
});
