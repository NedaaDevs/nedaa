import { screen } from "@testing-library/react-native";

import DhikrChallenge from "@/components/alarm/challenges/DhikrChallenge";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { renderWithTheme } from "@/test-helpers/theme";
import { DHIKR_PHRASES } from "@/types/alarm";

jest.mock("@/hooks/useHaptic", () => ({ useHaptic: () => jest.fn() }));

const DIFFICULTY = "easy";

describe("DhikrChallenge", () => {
  afterAll(() => i18n.changeLanguage(AppLocale.EN));

  // An Arabic voice reads Arabic script, which the challenge also accepts.
  it("gives an Arabic screen reader the Arabic phrase", async () => {
    await i18n.changeLanguage(AppLocale.AR);
    await renderWithTheme(<DhikrChallenge difficulty={DIFFICULTY} onComplete={jest.fn()} />);

    const spoken = DHIKR_PHRASES[DIFFICULTY].map(({ arabic }) =>
      i18n.t("a11y.alarm.dhikrPhrase", { arabic })
    );
    const label = spoken.find((candidate) => screen.queryByLabelText(candidate));
    expect(label).toBeDefined();
  });
});
