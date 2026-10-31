import { StyleSheet } from "react-native";
import { screen } from "@testing-library/react-native";

import AutoScrollControl from "@/components/quran/AutoScrollControl";
import { AppDirection } from "@/enums/app";
import { QuranTheme } from "@/enums/quran";
import i18n from "@/localization/i18n";
import { usePreferencesStore } from "@/stores/preferences";
import { drawnSides, onPhone } from "@/test-helpers/nativeSurface";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("moti", () => {
  const { View } = jest.requireActual("react-native");
  return { MotiView: View };
});

describe("AutoScrollControl pill", () => {
  beforeEach(() => usePreferencesStore.setState({ largeControls: false }));

  // A physical edge moves with the phone's language; the pill follows the app's.
  it.each(Object.values(AppDirection))(
    "keeps its edges when the phone reads RTL in a %s app",
    async (app) => {
      await renderWithTheme(<AutoScrollControl quranTheme={QuranTheme.SEPIA} visible />, {
        isRTL: app === AppDirection.RTL,
      });
      const play = screen.getByRole("button", { name: i18n.t("a11y.quran.autoScrollPlay") });
      const pill = play.parent;

      for (const part of [play, pill]) {
        const style = StyleSheet.flatten(part?.props.style);
        expect(drawnSides(onPhone(style, AppDirection.RTL), app)).toEqual(drawnSides(style, app));
      }
    }
  );
});
