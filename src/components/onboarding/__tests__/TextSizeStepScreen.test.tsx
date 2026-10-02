import { PixelRatio } from "react-native";
import { act, render, screen } from "@testing-library/react-native";

import TextSizeStep from "@/components/onboarding/steps/TextSizeStep";
import { TEXT_SIZE_MULTIPLIERS } from "@/constants/TextSize";
import { AppLocale, TextSize } from "@/enums/app";
import i18n from "@/localization/i18n";
import { usePreferencesStore } from "@/stores/preferences";
import { ThemeProvider } from "@/test-helpers/theme";
import { fontSizeOf, styleOf } from "@/test-helpers/text";

const t = i18n.t.bind(i18n);

const show = () => render(<TextSizeStep onNext={jest.fn()} />, { wrapper: ThemeProvider });

describe("TextSizeStep", () => {
  beforeEach(async () => {
    await act(() => i18n.changeLanguage(AppLocale.EN));
    usePreferencesStore.setState({ textSize: TextSize.DEFAULT, textSizeOfferHandled: false });
    jest.spyOn(PixelRatio, "getFontScale").mockReturnValue(1.3);
  });
  afterEach(() => jest.restoreAllMocks());

  it("opens at the preset nearest the device's font scale", async () => {
    await show();

    expect(usePreferencesStore.getState().textSize).toBe(TextSize.XLARGE);
  });

  it("keeps a choice already made", async () => {
    usePreferencesStore.setState({ textSize: TextSize.LARGE, textSizeOfferHandled: true });
    await show();

    expect(usePreferencesStore.getState().textSize).toBe(TextSize.LARGE);
  });

  it("sets each preset's name at that preset's size", async () => {
    await show();

    for (const preset of Object.values(TextSize))
      expect(styleOf(screen.getByText(t(`settings.textSize.options.${preset}`))).fontSize).toBe(
        fontSizeOf("md") * TEXT_SIZE_MULTIPLIERS[preset]
      );
  });
});
