import { screen, userEvent, within } from "@testing-library/react-native";

import { SUBHA_KNOTS_PART } from "@/components/athkar/looks/subha/SubhaKnots";
import { SUBHA_READER_PART, SubhaReader } from "@/components/athkar/looks/subha/SubhaReader";
import { ATHKAR_LOOKS } from "@/components/athkar/looks/registry";
import { SUBHA_SLAB_PART } from "@/components/athkar/looks/subha/SubhaSlab";
import { SUBHA_STRING_PART } from "@/components/athkar/looks/subha/SubhaString";
import type { AthkarLookProps } from "@/components/athkar/looks/types";
import { ATHKAR_LOOK } from "@/constants/AthkarLook";
import { MARK_STATE } from "@/constants/AthkarSession";
import { SUBHA_SLAB } from "@/constants/AthkarSubha";
import { AppLocale } from "@/enums/app";
import type { AthkarSession } from "@/hooks/useAthkarSession";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { renderWithTheme } from "@/test-helpers/theme";
import { SAMPLE_SESSION } from "@/utils/athkarSampleSession";

jest.mock("expo-blur", () => jest.requireActual("@/test-helpers/blurMock"));
jest.mock("@/hooks/useHaptic", () => jest.requireActual("@/test-helpers/hapticMock"));
jest.mock("@/utils/appLogger", () => ({
  AppLogger: { create: () => ({ i: jest.fn(), w: jest.fn(), e: jest.fn() }) },
}));
jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

const t = i18n.t.bind(i18n);
const hidden = { includeHiddenElements: true };
const sample = SAMPLE_SESSION.current!;

type Over = Partial<NonNullable<AthkarSession["current"]>>;

const sessionWith = (over: Over = {}, canUndo = true): AthkarSession => ({
  ...SAMPLE_SESSION,
  current: { ...sample, ...over },
  canUndo,
  add: jest.fn(),
  undo: jest.fn(),
});

const renderReader = async (over: Partial<AthkarLookProps> = {}) => {
  const props: AthkarLookProps = {
    session: sessionWith(),
    onOpenList: jest.fn(),
    onOpenFocus: jest.fn(),
    onStartAudio: jest.fn(),
    ...over,
  };
  await renderWithTheme(<SubhaReader {...props} />);
  return { props, user: userEvent.setup() };
};

beforeAll(() => {
  useAppStore.setState({ locale: AppLocale.EN });
  usePreferencesStore.setState({ useWesternNumerals: true });
});

describe("SubhaReader", () => {
  it("is registered as a look named Subha", () => {
    expect(ATHKAR_LOOKS[ATHKAR_LOOK.SUBHA].Reader).toBe(SubhaReader);
    expect(t(ATHKAR_LOOKS[ATHKAR_LOOK.SUBHA].name)).toBe("Subha");
    expect(i18n.getFixedT(AppLocale.AR)(ATHKAR_LOOKS[ATHKAR_LOOK.SUBHA].name)).toBe("السبحة");
  });

  it("leaves the sun to the page sky", () => {
    expect(ATHKAR_LOOKS[ATHKAR_LOOK.SUBHA].drawsSun).toBe(false);
  });

  it("draws the count as beads on a string inside the dhikr's slab", async () => {
    await renderReader();
    const front = screen.getByTestId(SUBHA_SLAB_PART.FRONT);
    expect(within(front).getByTestId(SUBHA_STRING_PART.STRING, hidden)).toBeOnTheScreen();
    expect(within(front).getByTestId(SUBHA_READER_PART.TEXT)).toBeOnTheScreen();
  });

  it("stacks a slab behind for each dhikr still to come, up to two", async () => {
    await renderReader();
    const waiting = SAMPLE_SESSION.marks.filter(({ state }) => state === MARK_STATE.REMAINING);
    expect(waiting.length).toBeGreaterThan(0);
    expect(screen.queryAllByTestId(SUBHA_SLAB_PART.BEHIND, hidden)).toHaveLength(
      Math.min(waiting.length, SUBHA_SLAB.BEHIND.length)
    );
  });

  it("opens each new text of the dhikr at its top", async () => {
    const props = { onOpenList: jest.fn(), onOpenFocus: jest.fn(), onStartAudio: jest.fn() };
    const view = await renderWithTheme(<SubhaReader session={sessionWith()} {...props} />);
    const before = screen.getByTestId(SUBHA_READER_PART.SCROLL);
    await view.rerender(
      <SubhaReader session={sessionWith({ textKey: `${sample.textKey}-next` })} {...props} />
    );
    expect(screen.getByTestId(SUBHA_READER_PART.SCROLL)).not.toBe(before);
  });

  it("counts a repeat when the dhikr is pressed", async () => {
    const { props, user } = await renderReader();
    await user.press(screen.getByTestId(SUBHA_READER_PART.TEXT));
    expect(props.session.add).toHaveBeenCalledTimes(1);
  });

  it("writes the count against its target under the dhikr", async () => {
    await renderReader();
    expect(screen.getByText(`${sample.count}`)).toBeOnTheScreen();
    expect(
      screen.getByText(t("athkar.focus.ofTarget", { target: `${sample.target}` }))
    ).toBeOnTheScreen();
  });

  it("takes no press while audio owns the count, and says why", async () => {
    const { props, user } = await renderReader({ session: sessionWith({ audioOwnsCount: true }) });
    await user.press(screen.getByTestId(SUBHA_READER_PART.TEXT));
    expect(props.session.add).not.toHaveBeenCalled();
    expect(screen.getByText(t("athkar.session.audioCounts"))).toBeOnTheScreen();
  });

  it("takes a repeat back", async () => {
    const { props, user } = await renderReader();
    await user.press(screen.getByRole("button", { name: t("athkar.session.undo") }));
    expect(props.session.undo).toHaveBeenCalledTimes(1);
  });

  it("disables undo with nothing counted", async () => {
    await renderReader({ session: sessionWith({ count: 0 }, false) });
    expect(screen.getByRole("button", { name: t("athkar.session.undo") })).toBeDisabled();
  });

  it("opens the session list from the knots, which name the place", async () => {
    const { props, user } = await renderReader();
    const knots = screen.getByTestId(SUBHA_READER_PART.POSITION);
    expect(knots.props.accessibilityLabel).toMatch(/\d+ of \d+/);
    expect(screen.getByTestId(SUBHA_KNOTS_PART.CURRENT, hidden)).toBeOnTheScreen();
    await user.press(knots);
    expect(props.onOpenList).toHaveBeenCalledTimes(1);
  });

  it("opens Focus and starts the audio from the foot of the reader", async () => {
    const { props, user } = await renderReader();
    await user.press(screen.getByRole("button", { name: t("athkar.session.focus.title") }));
    expect(props.onOpenFocus).toHaveBeenCalledTimes(1);
    await user.press(screen.getByRole("button", { name: t("a11y.athkar.startAudioSession") }));
    expect(props.onStartAudio).toHaveBeenCalledTimes(1);
  });

  it("names the next dhikr", async () => {
    await renderReader();
    expect(screen.getByTestId(SUBHA_READER_PART.NEXT)).toBeOnTheScreen();
    expect(screen.getByText(t("athkar.focus.next"))).toBeOnTheScreen();
  });

  it("draws the dhikr and its count alone while being tried on", async () => {
    await renderReader({ trying: true });
    expect(screen.getByTestId(SUBHA_READER_PART.TEXT)).toBeOnTheScreen();
    expect(screen.queryByTestId(SUBHA_READER_PART.NEXT)).toBeNull();
    expect(screen.queryByRole("button", { name: t("athkar.session.focus.title") })).toBeNull();
  });
});
