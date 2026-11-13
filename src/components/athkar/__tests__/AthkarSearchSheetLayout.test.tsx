import { screen } from "@testing-library/react-native";

import AthkarSearchSheet from "@/components/athkar/AthkarSearchSheet";
import { SHEET_INPUT_TEXT } from "@/components/ui/sheet-input";
import { tokenLine } from "@/components/ui/text/sizing";
import { TEXT_SIZE_MULTIPLIERS } from "@/constants/TextSize";
import { TextScaleContext } from "@/hooks/useTextScale";
import i18n from "@/localization/i18n";
import { lineRoomOf } from "@/test-helpers/text";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("react-native-safe-area-context", () =>
  jest.requireActual("@/test-helpers/safeAreaMock")
);
jest.mock("@/hooks/useHaptic", () => jest.requireActual("@/test-helpers/hapticMock"));
jest.mock("@/services/hisn-muslim-db", () => ({
  HisnMuslimDB: {
    getCategories: async () => [],
    search: async () => [],
    getCategoryAthkar: async () => [],
  },
}));

// The real Card and field, so the row's own padding counts against the line.
it.each(Object.values(TEXT_SIZE_MULTIPLIERS))(
  "the search row leaves its field a full line at text scale %s",
  async (m) => {
    await renderWithTheme(
      <TextScaleContext value={m}>
        <AthkarSearchSheet isOpen onClose={() => {}} />
      </TextScaleContext>
    );
    const field = screen.getByPlaceholderText(i18n.t("athkar.myAthkar.search"));

    expect(lineRoomOf(field)).toBeGreaterThanOrEqual(tokenLine(m, SHEET_INPUT_TEXT).lineHeight);
  }
);
