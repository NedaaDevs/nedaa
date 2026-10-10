import { transformSync } from "@babel/core";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const plugin = require("../../scripts/babel/lucideDirectImports");

const PACKAGE = "lucide-react-native";
const rewrite = (code: string) =>
  transformSync(code, {
    babelrc: false,
    configFile: false,
    plugins: [plugin],
    parserOpts: { plugins: ["typescript"] },
  })!.code!;

describe("lucideDirectImports", () => {
  it("imports each icon from its own module", () => {
    const out = rewrite(`import { Compass, Sun as Day } from "${PACKAGE}";`);

    expect(out).toContain(`import Compass from "${PACKAGE}/icons/compass";`);
    expect(out).toContain(`import Day from "${PACKAGE}/icons/sun";`);
    expect(out).not.toContain(`from "${PACKAGE}";`);
  });

  // An alias resolves to the module of the name it points to.
  it("follows an alias to the module it shares", () => {
    expect(rewrite(`import { AlarmCheck } from "${PACKAGE}";`)).toContain(
      `import AlarmCheck from "${PACKAGE}/icons/alarm-clock-check";`
    );
  });

  it("leaves names that are not icons, and types, on the package", () => {
    const out = rewrite(`import { Compass, createLucideIcon, type LucideIcon } from "${PACKAGE}";`);

    expect(out).toContain(`import Compass from "${PACKAGE}/icons/compass";`);
    expect(out).toMatch(
      /import \{ createLucideIcon, type LucideIcon \} from "lucide-react-native";/
    );
  });

  it("leaves other packages alone", () => {
    const code = `import { Compass } from "other-icons";`;
    expect(rewrite(code)).toBe(code);
  });
});
