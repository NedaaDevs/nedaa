import { resolveThemeColor } from "@/components/ui/theme-color";

const THEME: Record<string, string> = { accentPrimary: "#1C5D7D", background: "#F5F7FA" };
const lookup = (key: string) => THEME[key];

describe("resolveThemeColor", () => {
  it("reads a token from the theme", () => {
    expect(resolveThemeColor("$accentPrimary", lookup)).toBe(THEME.accentPrimary);
  });

  // Art files pass palette values they computed themselves.
  it.each(["#123456", "rgba(0, 0, 0, 0.5)", "transparent"])("passes %s through", (colour) => {
    expect(resolveThemeColor(colour, lookup)).toBe(colour);
  });
});
