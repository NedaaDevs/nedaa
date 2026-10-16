import { StyleSheet } from "react-native";
import { screen } from "@testing-library/react-native";

import DownloadProgressScreen from "@/components/quran/DownloadProgressScreen";
import { AppDirection } from "@/enums/app";
import { MushafVersion } from "@/enums/quran";
import i18n from "@/localization/i18n";
import { PHONE_APP_PAIRS, onPhone } from "@/test-helpers/nativeSurface";
import { renderWithTheme } from "@/test-helpers/theme";
import { layOutSpans } from "@/test-helpers/yogaPlacement";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("moti", () => {
  const { View } = jest.requireActual("react-native");
  return { MotiView: View, AnimatePresence: View };
});
jest.mock("react-native-safe-area-context", () =>
  jest.requireActual("@/test-helpers/safeAreaMock")
);
jest.mock("@/hooks/useHaptic", () => jest.requireActual("@/test-helpers/hapticMock"));
jest.mock("@/services/quran-manifest", () => ({
  QuranManifestService: { getVersionInfo: () => Promise.resolve(null) },
}));
jest.mock("@/services/quran-download", () => ({ QuranDownload: {} }));

const SCREEN_WIDTH = 390;

describe("DownloadProgressScreen back button", () => {
  it.each(PHONE_APP_PAIRS)(
    "sits at the reading start on a $phone phone in a $app app",
    async ({ phone, app }) => {
      await renderWithTheme(
        <DownloadProgressScreen
          version={MushafVersion.V1}
          versionName=""
          onStartReading={jest.fn()}
          onCancel={jest.fn()}
          onBack={jest.fn()}
        />,
        { isRTL: app === AppDirection.RTL }
      );
      const back = screen.getByRole("button", { name: i18n.t("a11y.back") });

      const [, span] = await layOutSpans(
        {
          style: { width: SCREEN_WIDTH },
          children: [{ style: onPhone(StyleSheet.flatten(back.props.style), phone) }],
        },
        app
      );

      const centre = span.left + span.width / 2;
      if (app === AppDirection.RTL) expect(centre).toBeGreaterThan(SCREEN_WIDTH / 2);
      else expect(centre).toBeLessThan(SCREEN_WIDTH / 2);
    }
  );
});
