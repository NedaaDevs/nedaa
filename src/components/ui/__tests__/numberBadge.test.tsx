import { render, screen } from "@testing-library/react-native";
import { TamaguiProvider } from "tamagui";

import config from "../../../../tamagui.config";
import { NumberBadge } from "@/components/ui/number-badge";
import { AppLocale } from "@/enums/app";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";

jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

const renderWithTheme = (ui: React.ReactElement) =>
  render(ui, {
    wrapper: ({ children }) => (
      <TamaguiProvider config={config} defaultTheme="light">
        {children}
      </TamaguiProvider>
    ),
  });

const LIGHT = config.themes.light;
const N = 3;
const INK = "#123456";
const FILL = "#FEDCBA";

const badge = () => screen.getByText(String(N));

describe("NumberBadge", () => {
  afterEach(() => {
    useAppStore.setState({ locale: AppLocale.EN });
    usePreferencesStore.setState({ useWesternNumerals: false });
  });

  it("writes Arabic-Indic digits in Arabic", async () => {
    useAppStore.setState({ locale: AppLocale.AR });
    usePreferencesStore.setState({ useWesternNumerals: false });

    await renderWithTheme(<NumberBadge n={N} />);

    expect(screen.getByText("٣")).toBeOnTheScreen();
  });

  it.each([
    ["sm", 20],
    ["md", 24],
  ] as const)("%s is %spt across", async (size, diameter) => {
    await renderWithTheme(<NumberBadge n={N} size={size} />);

    expect(badge()).toHaveStyle({ width: diameter, height: diameter });
  });

  // The Ihram art places its badges by coordinates that assume the small size.
  it("defaults to small where the art places it", async () => {
    await renderWithTheme(<NumberBadge n={N} x={0} y={0} color={INK} bg={FILL} />);

    expect(badge()).toHaveStyle({ width: 20, height: 20, position: "absolute" });
  });

  it("reads its colours from the theme by default", async () => {
    await renderWithTheme(<NumberBadge n={N} />);

    expect(badge()).toHaveStyle({
      color: LIGHT.accentPrimary.val,
      borderColor: LIGHT.accentPrimary.val,
      backgroundColor: LIGHT.background.val,
    });
  });

  it("inks the digit and rim, and fills the disc", async () => {
    await renderWithTheme(<NumberBadge n={N} color={INK} bg={FILL} />);

    expect(badge()).toHaveStyle({ color: INK, borderColor: INK, backgroundColor: FILL });
  });
});
