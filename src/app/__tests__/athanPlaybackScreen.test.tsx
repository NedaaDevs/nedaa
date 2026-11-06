import { screen } from "@testing-library/react-native";

import AthanPlaybackSettings from "@/app/settings/athanPlayback";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("@/components/ui/screen-header", () => ({ ScreenHeader: () => null }));
jest.mock("@/hooks/useHaptic", () => ({ useHaptic: () => jest.fn() }));
jest.mock("@/hooks/useNotificationSettings", () => ({
  useNotificationSettings: () => ({
    fullAthanPlayback: false,
    athanAudioStream: undefined,
    updateFullAthanPlayback: jest.fn(),
    updateAthanAudioStream: jest.fn(),
    fullIqamaPlayback: false,
    iqamaAudioStream: undefined,
    updateFullIqamaPlayback: jest.fn(),
    updateIqamaAudioStream: jest.fn(),
  }),
}));

const t = i18n.t.bind(i18n);

describe("Athan playback", () => {
  beforeAll(() => i18n.changeLanguage(AppLocale.EN));

  it("says where the custom sounds button goes", async () => {
    await renderWithTheme(<AthanPlaybackSettings />);

    expect(screen.getByRole("button", { name: t("notification.customSound.manage") })).toHaveProp(
      "accessibilityHint",
      t("a11y.opens", { name: t("notification.customSound.title") })
    );
  });
});
