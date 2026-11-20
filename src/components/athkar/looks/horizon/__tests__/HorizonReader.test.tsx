import { screen, userEvent } from "@testing-library/react-native";

import { HORIZON_ARC_PART } from "@/components/athkar/looks/horizon/HorizonArc";
import {
  HORIZON_READER_PART,
  HorizonReader,
} from "@/components/athkar/looks/horizon/HorizonReader";
import { ATHKAR_LOOKS } from "@/components/athkar/looks/registry";
import type { AthkarLookProps } from "@/components/athkar/looks/types";
import { ATHKAR_LOOK } from "@/constants/AthkarLook";
import { AppLocale } from "@/enums/app";
import type { AthkarSession } from "@/hooks/useAthkarSession";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { renderWithTheme } from "@/test-helpers/theme";
import { SAMPLE_SESSION } from "@/utils/athkarSampleSession";

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
  await renderWithTheme(<HorizonReader {...props} />);
  return { props, user: userEvent.setup() };
};

beforeAll(() => {
  useAppStore.setState({ locale: AppLocale.EN });
  usePreferencesStore.setState({ useWesternNumerals: true });
});

describe("HorizonReader", () => {
  it("is registered as a look named Horizon", () => {
    expect(ATHKAR_LOOKS[ATHKAR_LOOK.HORIZON].Reader).toBe(HorizonReader);
    expect(t(ATHKAR_LOOKS[ATHKAR_LOOK.HORIZON].name)).toBe("Horizon");
  });

  it("counts a repeat when the dhikr is pressed", async () => {
    const { props, user } = await renderReader();
    await user.press(screen.getByTestId(HORIZON_READER_PART.TEXT));
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
    await user.press(screen.getByTestId(HORIZON_READER_PART.TEXT));
    expect(props.session.add).not.toHaveBeenCalled();
    expect(screen.getByText(t("athkar.session.audioCounts"))).toBeOnTheScreen();
  });

  it("takes a repeat back, and offers nothing to take back at zero", async () => {
    const { props, user } = await renderReader();
    await user.press(screen.getByRole("button", { name: t("athkar.session.undo") }));
    expect(props.session.undo).toHaveBeenCalledTimes(1);
  });

  it("disables undo with nothing counted", async () => {
    await renderReader({ session: sessionWith({ count: 0 }, false) });
    expect(screen.getByRole("button", { name: t("athkar.session.undo") })).toBeDisabled();
  });

  it("opens the session list from the sun's arc, which names the place", async () => {
    const { props, user } = await renderReader();
    const arc = screen.getByTestId(HORIZON_READER_PART.POSITION);
    expect(arc.props.accessibilityLabel).toMatch(/\d+ of \d+/);
    expect(screen.getByTestId(HORIZON_ARC_PART.SUN, hidden)).toBeOnTheScreen();
    await user.press(arc);
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
    expect(screen.getByTestId(HORIZON_READER_PART.NEXT)).toBeOnTheScreen();
    expect(screen.getByText(t("athkar.focus.next"))).toBeOnTheScreen();
  });

  it("draws the dhikr and its count alone while being tried on", async () => {
    await renderReader({ trying: true });
    expect(screen.getByTestId(HORIZON_READER_PART.TEXT)).toBeOnTheScreen();
    expect(screen.queryByTestId(HORIZON_READER_PART.NEXT)).toBeNull();
    expect(screen.queryByRole("button", { name: t("athkar.session.focus.title") })).toBeNull();
  });
});
