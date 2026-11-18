import { screen, within } from "@testing-library/react-native";

import { SESSION_LIST_PART, SessionListSheet } from "@/components/athkar/session/SessionListSheet";
import { TEXT_END_ROOM } from "@/components/ui/text";
import { AppLocale } from "@/enums/app";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { renderWithTheme } from "@/test-helpers/theme";
import type { SessionItem } from "@/utils/athkarSession";
import { keyText } from "@/utils/athkarText";

// The text primitive reads the platform once, at load; this file runs as Android.
jest.mock("react-native", () => {
  const native = jest.requireActual("react-native");
  const { PlatformType } = jest.requireActual("@/enums/app");
  native.Platform.OS = PlatformType.ANDROID;
  return native;
});
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("react-native-safe-area-context", () =>
  jest.requireActual("@/test-helpers/safeAreaMock")
);

const ROWS = 12;
// An open sheet hides its siblings from a reader; queries look past that.
const hidden = { includeHiddenElements: true };

const items: SessionItem[] = Array.from({ length: ROWS }, (_, i) => ({
  id: `${i}`,
  target: 1,
  texts: [keyText(`dhikr ${i + 1}`)],
  itemsPerRound: 1,
}));

beforeAll(() => {
  useAppStore.setState({ locale: AppLocale.EN });
  usePreferencesStore.setState({ useWesternNumerals: true });
});

describe("SessionListSheet on Android", () => {
  // The number's box is as wide as two digits; end room inside it wraps the second.
  it("gives a row's number its whole box", async () => {
    await renderWithTheme(
      <SessionListSheet
        open
        title="Morning athkar"
        items={items}
        counts={{}}
        index={0}
        onJump={jest.fn()}
        onClose={jest.fn()}
      />
    );
    const row = screen.getAllByTestId(SESSION_LIST_PART.ROW, hidden)[ROWS - 1];
    expect(within(row).getByText(`${ROWS}`)).not.toHaveStyle({ paddingEnd: TEXT_END_ROOM });
  });
});
