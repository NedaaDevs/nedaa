import { AccessibilityInfo } from "react-native";
import { screen, userEvent } from "@testing-library/react-native";
import { CHALLENGE_DIFFICULTY } from "expo-alarm";

import DhikrChallenge from "@/components/alarm/challenges/DhikrChallenge";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { renderWithTheme } from "@/test-helpers/theme";
import { DHIKR_PHRASES } from "@/types/alarm";

jest.mock("@/hooks/useHaptic", () => ({ useHaptic: () => jest.fn() }));

const DIFFICULTY = CHALLENGE_DIFFICULTY.EASY;
const STRIKES = 3;

const t = i18n.t.bind(i18n);

/** The phrase on screen. */
const shownPhrase = () => {
  const shown = DHIKR_PHRASES[DIFFICULTY].find(({ arabic, transliteration }) =>
    screen.queryByLabelText(t("a11y.alarm.dhikrPhrase", { arabic, transliteration }))
  );
  if (!shown) throw new Error("No phrase is on screen.");
  return shown;
};

// Queued lines only: the keyboard's close moves focus and would cut any other.
const said = () =>
  jest
    .mocked(AccessibilityInfo.announceForAccessibilityWithOptions)
    .mock.calls.filter(([, options]) => options.queue)
    .map(([message]) => message);

const miss = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.clear(screen.getByLabelText(t("alarm.challenge.dhikrPlaceholder")));
  await user.type(screen.getByLabelText(t("alarm.challenge.dhikrPlaceholder")), "xx");
  await user.press(screen.getByRole("button", { name: t("alarm.challenge.submit") }));
};

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
    await i18n.changeLanguage(AppLocale.EN);
  });

  describe("out loud", () => {
    const WRONG = () => t("alarm.challenge.wrongAnswer");

    beforeEach(() => {
      jest.useFakeTimers();
      jest.clearAllMocks();
    });
    afterEach(() => jest.useRealTimers());

    it("reads the phrase box as one element, and says a miss once", async () => {
      await renderWithTheme(<DhikrChallenge difficulty={DIFFICULTY} onComplete={jest.fn()} />);
      const { arabic, transliteration } = shownPhrase();
      const box = screen.getByLabelText(t("a11y.alarm.dhikrPhrase", { arabic, transliteration }));
      expect(box).toHaveProp("accessible", true);
      expect(box).not.toHaveProp("accessibilityLiveRegion");

      await miss(userEvent.setup());

      expect(said()).toEqual([WRONG()]);
      expect(screen.getByText(WRONG())).not.toHaveProp("accessibilityLiveRegion");
    });

    it("says the new phrase in the same sentence as the miss that brought it", async () => {
      await renderWithTheme(<DhikrChallenge difficulty={DIFFICULTY} onComplete={jest.fn()} />);
      const user = userEvent.setup();

      for (let strike = 0; strike < STRIKES; strike++) await miss(user);

      const { arabic, transliteration } = shownPhrase();
      expect(said()).toEqual([
        WRONG(),
        WRONG(),
        t("a11y.alarm.newDhikr", { arabic, transliteration }),
      ]);
    });
  });
});
