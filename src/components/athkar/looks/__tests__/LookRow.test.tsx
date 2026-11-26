import { screen, userEvent } from "@testing-library/react-native";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock(
  "expo-sqlite/kv-store",
  () => jest.requireActual("@/test-helpers/memoryKvStore").memoryKvStoreModule
);
jest.mock("@/services/athkar-db", () => ({ AthkarDB: {} }));
jest.mock("@/stores/location", () => ({
  __esModule: true,
  default: { getState: () => ({ locationDetails: { timezone: "Asia/Riyadh" } }) },
}));
jest.mock("@/utils/appLogger", () => ({
  AppLogger: { create: () => ({ i: jest.fn(), w: jest.fn(), e: jest.fn() }) },
}));
jest.mock("@/hooks/useHaptic", () => jest.requireActual("@/test-helpers/hapticMock"));
jest.mock("expo-blur", () => jest.requireActual("@/test-helpers/blurMock"));
jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@/components/athkar/looks/registry", () =>
  jest.requireActual("@/test-helpers/athkarLooks").registryWithTestLook()
);

/* eslint-disable import/first -- imports must follow jest.mock hoisting */
import { LOOK_PREVIEW_PART } from "@/components/athkar/looks/LookPreview";
import { LookRow } from "@/components/athkar/looks/LookRow";
import type { AthkarLookId } from "@/constants/AthkarLook";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import i18n from "@/localization/i18n";
import { useAthkarStore } from "@/stores/athkar";
import { TEST_LOOK_ID, TEST_LOOK_NAME, TEST_LOOK_PART } from "@/test-helpers/athkarLooks";
import { renderWithTheme } from "@/test-helpers/theme";
/* eslint-enable import/first */

const t = i18n.t.bind(i18n);
const DRAWN = { includeHiddenElements: true } as const;

const store = (look: AthkarLookId | null) =>
  useAthkarStore.setState((state) => ({ settings: { ...state.settings, look } }));

const row = (name: string) =>
  screen.getByRole("button", {
    name: t("a11y.join", { first: t("athkar.look.title"), second: name }),
  });

beforeEach(() => jest.clearAllMocks());
afterEach(() => store(null));

describe("LookRow", () => {
  it("names the look in use, and the default before a choice", async () => {
    await renderWithTheme(<LookRow />);
    expect(row(t("athkar.look.name.classic"))).toBeOnTheScreen();
    expect(screen.getByText(t("athkar.look.title"))).toBeOnTheScreen();
    expect(screen.getByText(t("athkar.look.name.classic"))).toBeOnTheScreen();
  });

  it("shows a picture of the look in use", async () => {
    store(TEST_LOOK_ID);
    await renderWithTheme(<LookRow />);

    expect(row(TEST_LOOK_NAME)).toBeOnTheScreen();
    expect(screen.getByTestId(LOOK_PREVIEW_PART.PICTURE, DRAWN)).toBeOnTheScreen();
    expect(screen.getByTestId(TEST_LOOK_PART.READER, DRAWN)).toBeOnTheScreen();
  });

  it("opens the chooser, and says so", async () => {
    await renderWithTheme(<LookRow />);
    const button = row(t("athkar.look.name.classic"));
    expect(button).toHaveProp("accessibilityHint", t("a11y.athkar.lookRowHint"));

    await userEvent.press(button);
    expect(mockPush).toHaveBeenCalledWith(BACK_DESTINATION.SETTINGS_ATHKAR_LOOK.href);
  });
});
