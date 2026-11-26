import QuranLibraryScreen from "@/app/quran-library";
import { renderRouter, screen } from "expo-router/testing-library";

import i18n from "@/localization/i18n";
import { QURAN_LIBRARY_TAB } from "@/constants/Quran";
import { useQuranStore } from "@/stores/quran";
import { ThemeProvider } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

jest.mock("@/app/quran-browse", () => {
  const { Text: MockText } = jest.requireActual("react-native");
  return { BrowseIndex: () => <MockText>browse-index</MockText> };
});
jest.mock("@/components/quran/library/BookmarksTab", () => ({ BookmarksTab: () => null }));
jest.mock("@/components/quran/library/HighlightsTab", () => ({ HighlightsTab: () => null }));
jest.mock("@/components/quran/library/KhatmahTab", () => ({ KhatmahTab: () => null }));
jest.mock("@/components/quran/library/GuideTab", () => ({ GuideTab: () => null }));

const ROUTE = "quran-library";
const INDEX_TAB = QURAN_LIBRARY_TAB.INDEX;
const DRAWER_ONLY_TAB = QURAN_LIBRARY_TAB.REMINDERS;

const renderLibrary = () =>
  renderRouter(
    {
      [ROUTE]: () => (
        <ThemeProvider>
          <QuranLibraryScreen />
        </ThemeProvider>
      ),
    },
    { initialUrl: `/${ROUTE}` }
  );

describe("QuranLibraryScreen", () => {
  afterEach(() => {
    useQuranStore.setState({ libraryTab: INDEX_TAB });
  });

  it("opens the index when the stored tab is one this screen does not show", async () => {
    useQuranStore.setState({ libraryTab: DRAWER_ONLY_TAB });
    await renderLibrary();

    expect(screen.getByText("browse-index")).toBeTruthy();
    expect(
      screen.getByRole("tab", { name: i18n.t("quran.library.index") }).props.accessibilityState
    ).toEqual({ selected: true });
  });
});
