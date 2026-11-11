import { screen } from "@testing-library/react-native";

import { SurahListRow } from "@/components/quran/listen/SurahListRow";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { usePreferencesStore } from "@/stores/preferences";
import { renderWithTheme } from "@/test-helpers/theme";

const AL_FATIHA = { surah: 1, ayahCount: 7 } as const;

const renderRow = () =>
  renderWithTheme(
    <SurahListRow
      surah={AL_FATIHA.surah}
      ayahCount={AL_FATIHA.ayahCount}
      isCurrent={false}
      isLoading={false}
      isDownloaded={false}
      isDownloading={false}
      isPaused={false}
      onPress={jest.fn()}
      onDownload={jest.fn()}
      onPause={jest.fn()}
      onDelete={jest.fn()}
    />,
    { isRTL: true }
  );

describe("SurahListRow", () => {
  beforeAll(() => usePreferencesStore.setState({ useWesternNumerals: true }));
  beforeEach(() => i18n.changeLanguage(AppLocale.AR));
  afterAll(() => i18n.changeLanguage(AppLocale.EN));

  // The count picks the Arabic plural form: seven takes «آيات», not «آية».
  it("states the ayah count in the form its number takes", async () => {
    await renderRow();

    expect(screen.getByText(/7 آيات/)).toBeOnTheScreen();
  });
});
