import { AccessibilityInfo, Platform } from "react-native";
import { screen, userEvent, within } from "@testing-library/react-native";

import {
  CLASSIC_READER_PART,
  ClassicReader,
} from "@/components/athkar/looks/classic/ClassicReader";
import type { AthkarLookProps } from "@/components/athkar/looks/types";
import { SESSION_STATUS } from "@/constants/AthkarSession";
import { HAPTIC_FEEDBACK, type HapticFeedback } from "@/constants/Haptics";
import { AppLocale, PlatformType } from "@/enums/app";
import type { AthkarSession } from "@/hooks/useAthkarSession";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { useAthkarStore } from "@/stores/athkar";
import { usePreferencesStore } from "@/stores/preferences";
import { renderWithTheme } from "@/test-helpers/theme";
import { positionMarks, type SessionItem } from "@/utils/athkarSession";
import { LTR_ISOLATE } from "@/utils/digits";

const mockHaptics: Partial<Record<HapticFeedback, jest.Mock>> = {};

jest.mock("@/hooks/useHaptic", () => ({
  useHaptic: (type: HapticFeedback) => (mockHaptics[type] ??= jest.fn()),
}));
// The text display reads the athkar store, which opens a database jest lacks.
jest.mock("@/utils/appLogger", () => ({
  AppLogger: { create: () => ({ i: jest.fn(), w: jest.fn(), e: jest.fn() }) },
}));
jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

const TOTAL = 18;
const TARGET = 3;
const PLACE = 8;
const PERCENT = /%/;

/** A text key no locale holds, so it draws as written. */
const textOf = (i: number) => `dhikr ${i + 1}`;

const items = (): SessionItem[] =>
  Array.from({ length: TOTAL }, (_, i) => ({
    id: `${i}`,
    target: TARGET,
    textKeys: [textOf(i)],
    itemsPerRound: 1,
  }));

const held = (text: string) => `${LTR_ISOLATE.OPEN}${text}${LTR_ISOLATE.CLOSE}`;

type SessionOptions = {
  count?: number;
  textKey?: string;
  nextKey?: string;
  last?: boolean;
  advancePending?: boolean;
  audioOwnsCount?: boolean;
};

const sessionOf = ({
  count = 1,
  textKey = textOf(PLACE),
  nextKey = textOf(PLACE + 1),
  last = false,
  advancePending = false,
  audioOwnsCount = false,
}: SessionOptions = {}): AthkarSession => {
  const list = items();
  const counts = { [list[PLACE].id]: count };
  return {
    status: SESSION_STATUS.READY,
    items: list,
    counts,
    index: PLACE,
    current: {
      item: list[PLACE],
      textKey,
      count,
      target: TARGET,
      done: count >= TARGET,
      audioOwnsCount,
    },
    next: last ? null : { textKey: nextKey },
    marks: positionMarks(list, counts, PLACE),
    canUndo: count > 0,
    advancePending,
    canStep: { previous: true, next: !last },
    add: jest.fn(),
    addMany: jest.fn(),
    undo: jest.fn(),
    jumpTo: jest.fn(),
    step: jest.fn(),
  };
};

const propsOf = (options?: SessionOptions): AthkarLookProps => ({
  session: sessionOf(options),
  onOpenList: jest.fn(),
  onOpenFocus: jest.fn(),
  onStartAudio: jest.fn(),
});

const renderReader = async (options?: SessionOptions) => {
  const props = propsOf(options);
  await renderWithTheme(<ClassicReader {...props} />);
  return props;
};

const ring = () => screen.getByRole("button", { name: new RegExp(i18n.t("a11y.athkar.addCount")) });
const undo = () => screen.getByRole("button", { name: i18n.t("athkar.session.undo") });

beforeAll(() => {
  useAppStore.setState({ locale: AppLocale.EN });
  usePreferencesStore.setState({ useWesternNumerals: true });
});

beforeEach(() => Object.values(mockHaptics).forEach((haptic) => haptic.mockClear()));

describe("ClassicReader", () => {
  it("draws the current dhikr from its text key", async () => {
    await renderReader();
    const text = within(screen.getByTestId(CLASSIC_READER_PART.TEXT_SCROLL));
    expect(text.getByText(textOf(PLACE))).toBeOnTheScreen();
  });

  it("keeps a long dhikr whole in the scroll view, with the ring below it", async () => {
    const long = Array.from({ length: 600 }, (_, i) => `word${i}`).join(" ");
    await renderReader({ textKey: long });
    const text = within(screen.getByTestId(CLASSIC_READER_PART.TEXT_SCROLL));
    expect(text.getByText(long)).toBeOnTheScreen();
    expect(ring()).toBeOnTheScreen();
  });

  it("adds one on a ring press", async () => {
    const { session } = await renderReader();
    await userEvent.press(ring());
    expect(session.add).toHaveBeenCalledTimes(1);
  });

  it("shows the count, the ratio and the tap hint", async () => {
    await renderReader({ count: 2 });
    // Spoken as words; the drawn figures keep the slash.
    expect(ring()).toHaveAccessibilityValue({
      text: i18n.t("a11y.athkar.cardProgress", { current: "2", total: `${TARGET}` }),
    });
    expect(screen.getByText(held(`2 / ${TARGET}`))).toBeOnTheScreen();
    expect(screen.getByText(i18n.t("athkar.focus.tapToIncrement"))).toBeOnTheScreen();
  });

  it("holds the ring during the pause before the next dhikr, and keeps undo", async () => {
    const { session } = await renderReader({ count: TARGET, advancePending: true });
    expect(ring()).toBeDisabled();
    await userEvent.press(ring());
    expect(session.add).not.toHaveBeenCalled();
    expect(screen.getByText(i18n.t("athkar.session.thikrDone"))).toBeOnTheScreen();
    await userEvent.press(undo());
    expect(session.undo).toHaveBeenCalledTimes(1);
  });

  it("holds the ring while audio counts, and says so", async () => {
    const { session } = await renderReader({ audioOwnsCount: true });
    const audioCounts = i18n.t("athkar.session.audioCounts");
    expect(ring()).toBeDisabled();
    expect(screen.getByRole("button", { name: new RegExp(audioCounts) })).toBe(ring());
    expect(screen.getByText(audioCounts)).toBeOnTheScreen();
    await userEvent.press(ring());
    expect(session.add).not.toHaveBeenCalled();
  });

  it("takes one back on undo", async () => {
    const { session } = await renderReader();
    await userEvent.press(undo());
    expect(session.undo).toHaveBeenCalledTimes(1);
  });

  it("disables undo at a count of zero", async () => {
    const { session } = await renderReader({ count: 0 });
    expect(undo()).toBeDisabled();
    await userEvent.press(undo());
    expect(session.undo).not.toHaveBeenCalled();
  });

  it("opens the list from the position", async () => {
    const { onOpenList } = await renderReader();
    const position = screen.getByRole("button", {
      name: i18n.t("athkar.audio.thikrProgress", { current: `${PLACE + 1}`, total: `${TOTAL}` }),
    });
    expect(within(position).getByText(held(`${PLACE + 1} / ${TOTAL}`))).toBeOnTheScreen();
    expect(position).toHaveProp("accessibilityHint", i18n.t("a11y.athkar.sessionListHint"));
    await userEvent.press(position);
    expect(onOpenList).toHaveBeenCalledTimes(1);
  });

  it("opens Focus from the Focus row", async () => {
    const { onOpenFocus } = await renderReader();
    await userEvent.press(
      screen.getByRole("button", { name: new RegExp(i18n.t("athkar.session.focus.title")) })
    );
    expect(onOpenFocus).toHaveBeenCalledTimes(1);
  });

  it("starts the audio session from the audio button", async () => {
    const { onStartAudio } = await renderReader();
    await userEvent.press(
      screen.getByRole("button", { name: i18n.t("a11y.athkar.startAudioSession") })
    );
    expect(onStartAudio).toHaveBeenCalledTimes(1);
  });

  it("names the dhikr that opens next", async () => {
    await renderReader();
    const next = within(screen.getByTestId(CLASSIC_READER_PART.NEXT));
    expect(next.getByText(i18n.t("athkar.focus.next"))).toBeOnTheScreen();
    expect(next.getByText(textOf(PLACE + 1))).toBeOnTheScreen();
  });

  describe("a next dhikr that holds a translation and its Arabic", () => {
    const ARABIC = "سبحان الله";
    const TRANSLATION = "Glory be to Allah";
    const nextKey = `${TRANSLATION}\n${ARABIC}`;
    const showTranslation = (show: boolean) =>
      useAthkarStore.setState((s) => ({ settings: { ...s.settings, showTranslation: show } }));
    const next = () => within(screen.getByTestId(CLASSIC_READER_PART.NEXT));

    it("is named by its translation where translations show", async () => {
      showTranslation(true);
      await renderReader({ nextKey });
      expect(next().getByText(TRANSLATION)).toBeOnTheScreen();
    });

    it("is named by its Arabic where translations are hidden", async () => {
      showTranslation(false);
      await renderReader({ nextKey });
      expect(next().getByText(ARABIC)).toBeOnTheScreen();
    });
  });

  it("says the last open dhikr is the last", async () => {
    await renderReader({ last: true });
    const next = within(screen.getByTestId(CLASSIC_READER_PART.NEXT));
    expect(next.getByText(i18n.t("athkar.session.lastThikr"))).toBeOnTheScreen();
    expect(next.queryByText(i18n.t("athkar.focus.next"))).toBeNull();
  });

  it("writes and speaks no percent", async () => {
    await renderReader({ count: 2 });
    expect(screen.queryByText(PERCENT)).toBeNull();
    expect(screen.queryByLabelText(PERCENT)).toBeNull();
    expect(screen.queryByHintText(PERCENT)).toBeNull();
  });

  it("gives a selection haptic on a tap, and success on the tap that reaches the target", async () => {
    await renderReader({ count: TARGET - 2 });
    await userEvent.press(ring());
    expect(mockHaptics[HAPTIC_FEEDBACK.SELECTION]).toHaveBeenCalledTimes(1);
    expect(mockHaptics[HAPTIC_FEEDBACK.SUCCESS]).not.toHaveBeenCalled();
    await screen.unmount();

    await renderReader({ count: TARGET - 1 });
    await userEvent.press(ring());
    expect(mockHaptics[HAPTIC_FEEDBACK.SELECTION]).toHaveBeenCalledTimes(2);
    expect(mockHaptics[HAPTIC_FEEDBACK.SUCCESS]).toHaveBeenCalledTimes(1);
  });

  it("opens each dhikr at the top of its text", async () => {
    const props = propsOf();
    const view = await renderWithTheme(<ClassicReader {...props} />);
    const scroller = screen.getByTestId(CLASSIC_READER_PART.TEXT_SCROLL);
    await view.rerender(<ClassicReader {...props} session={sessionOf({ count: 1 })} />);
    expect(screen.getByTestId(CLASSIC_READER_PART.TEXT_SCROLL)).toBe(scroller);

    // A new scroller starts at the top; a kept one holds the last dhikr's offset.
    await view.rerender(<ClassicReader {...props} session={sessionOf({ textKey: textOf(0) })} />);
    expect(screen.getByTestId(CLASSIC_READER_PART.TEXT_SCROLL)).not.toBe(scroller);
  });

  // A live region speaks on Android only; VoiceOver hears it said.
  it("says the count on iOS as it changes, and nothing on opening", async () => {
    Platform.OS = PlatformType.IOS;
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    const props = propsOf({ count: 1 });
    const view = await renderWithTheme(<ClassicReader {...props} />);
    expect(announce).not.toHaveBeenCalled();
    await view.rerender(<ClassicReader {...props} session={sessionOf({ count: 2 })} />);
    expect(announce).toHaveBeenCalledWith(
      i18n.t("a11y.athkar.cardProgress", { current: "2", total: `${TARGET}` })
    );
    announce.mockRestore();
  });
});
