import { act, fireEvent, screen, userEvent, within } from "@testing-library/react-native";

import {
  SESSION_LIST_LEAD_ROWS,
  SESSION_LIST_PART,
  SESSION_LIST_ROW_MIN_HEIGHT,
  SessionListSheet,
} from "@/components/athkar/session/SessionListSheet";
import { ACTIONSHEET_PART } from "@/components/ui/actionsheet";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { useAthkarStore } from "@/stores/athkar";
import { usePreferencesStore } from "@/stores/preferences";
import { holdSheetsRising, settleSheet } from "@/test-helpers/bottomSheetMock";
import { renderWithTheme } from "@/test-helpers/theme";
import type { Counts, SessionItem } from "@/utils/athkarSession";
import { LTR_ISOLATE } from "@/utils/digits";
import { keyText } from "@/utils/athkarText";

const mockScrollTo = jest.fn();

// The shared mock, with a scroll view whose handle records each scroll.
jest.mock("@gorhom/bottom-sheet", () => {
  const { useImperativeHandle } = jest.requireActual<typeof import("react")>("react");
  const actual = jest.requireActual<typeof import("@/test-helpers/bottomSheetMock")>(
    "@/test-helpers/bottomSheetMock"
  );
  const BottomSheetScrollView = ({
    ref,
    ...props
  }: import("react-native").ScrollViewProps & {
    ref?: import("react").Ref<{ scrollTo: jest.Mock }>;
  }) => {
    useImperativeHandle(ref, () => ({ scrollTo: mockScrollTo }));
    return <actual.BottomSheetScrollView {...props} />;
  };
  return { ...actual, BottomSheetScrollView };
});
// The row reads the athkar store, which opens a database jest lacks.
jest.mock("@/utils/appLogger", () => ({
  AppLogger: { create: () => ({ i: jest.fn(), w: jest.fn(), e: jest.fn() }) },
}));
jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("react-native-safe-area-context", () =>
  jest.requireActual("@/test-helpers/safeAreaMock")
);

const TITLE = "Morning athkar";
const TARGET = 3;
/** Where the list lays the current row out, in points from its top. */
const ROW_Y = 448;
// An open sheet hides its siblings from a reader; queries look past that.
const hidden = { includeHiddenElements: true };

/** A text key no locale holds, so it draws as written. */
const textOf = (i: number, round = 0) => `dhikr ${i + 1}.${round}`;

const items = (count: number): SessionItem[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `${i}`,
    target: TARGET,
    texts: [keyText(textOf(i))],
    itemsPerRound: 1,
  }));

const held = (text: string) => `${LTR_ISOLATE.OPEN}${text}${LTR_ISOLATE.CLOSE}`;
const done = () => i18n.t("a11y.athkar.cardComplete");
const rows = () => screen.getAllByTestId(SESSION_LIST_PART.ROW, hidden);

type Options = {
  open?: boolean;
  list?: readonly SessionItem[];
  counts?: Counts;
  index?: number | null;
  onJump?: (index: number) => void;
  onClose?: () => void;
};

const renderSheet = ({
  open = true,
  list = items(18),
  counts = {},
  index = 0,
  onJump = jest.fn(),
  onClose = jest.fn(),
}: Options = {}) =>
  renderWithTheme(
    <SessionListSheet
      open={open}
      title={TITLE}
      items={list}
      counts={counts}
      index={index}
      onJump={onJump}
      onClose={onClose}
    />
  );

beforeEach(() => mockScrollTo.mockClear());

beforeAll(() => {
  useAppStore.setState({ locale: AppLocale.EN });
  usePreferencesStore.setState({ useWesternNumerals: true });
});

describe("SessionListSheet", () => {
  it("draws nothing while closed", async () => {
    await renderSheet({ open: false });
    expect(screen.queryByTestId(SESSION_LIST_PART.ROW, hidden)).toBeNull();
  });

  it("heads the list with the session's title and one row per dhikr", async () => {
    await renderSheet();
    expect(screen.getByRole("header", { name: TITLE, ...hidden })).toBeOnTheScreen();
    expect(rows()).toHaveLength(18);
  });

  it("shows each row's number, its text and how far its count is", async () => {
    await renderSheet({ counts: { 2: 2 } });
    const third = within(rows()[2]);
    expect(third.getByText("3")).toBeOnTheScreen();
    expect(third.getByText(textOf(2))).toBeOnTheScreen();
    expect(third.getByText(held(`2 / ${TARGET}`))).toBeOnTheScreen();
    expect(third.queryByTestId(SESSION_LIST_PART.CHECK)).toBeNull();
  });

  describe("a text that holds a translation and its Arabic", () => {
    const ARABIC = "سبحان الله";
    const TRANSLATION = "Glory be to Allah";
    const both: SessionItem = {
      id: "both",
      target: TARGET,
      texts: [keyText(`${TRANSLATION}\n${ARABIC}`)],
      itemsPerRound: 1,
    };
    const showTranslation = (show: boolean) =>
      useAthkarStore.setState((s) => ({ settings: { ...s.settings, showTranslation: show } }));

    it("draws and speaks the translation where translations show", async () => {
      showTranslation(true);
      await renderSheet({ list: [both] });
      expect(within(rows()[0]).getByText(TRANSLATION)).toBeOnTheScreen();
      expect(rows()[0].props.accessibilityLabel).toContain(TRANSLATION);
      expect(rows()[0].props.accessibilityLabel).not.toContain(ARABIC);
    });

    it("draws the Arabic alone where translations are hidden", async () => {
      showTranslation(false);
      await renderSheet({ list: [both] });
      expect(within(rows()[0]).getByText(ARABIC)).toBeOnTheScreen();
      expect(within(rows()[0]).queryByText(TRANSLATION, { exact: false })).toBeNull();
    });
  });

  it("holds a two-digit row number on one line", async () => {
    await renderSheet();
    const number = within(rows()[9]).getByText("10");
    expect(number.props.numberOfLines).toBe(1);
  });

  it("marks a finished dhikr with a check and says it is complete", async () => {
    await renderSheet({ counts: { 1: TARGET } });
    const second = rows()[1];
    expect(within(second).getByTestId(SESSION_LIST_PART.CHECK)).toBeOnTheScreen();
    expect(within(second).queryByText(held(`${TARGET} / ${TARGET}`))).toBeNull();
    expect(second.props.accessibilityLabel).toContain(done());
  });

  it("names an open row by its text and its count", async () => {
    await renderSheet({ counts: { 2: 2 } });
    const label = rows()[2].props.accessibilityLabel;
    expect(label).toContain(textOf(2));
    expect(label).toContain(
      i18n.t("a11y.athkar.cardProgress", { current: "2", total: `${TARGET}` })
    );
    expect(label).not.toContain("/");
    expect(label).not.toContain(done());
  });

  it("selects the current row alone and tags it", async () => {
    await renderSheet({ index: 4 });
    const selected = rows().filter((row) => row.props.accessibilityState.selected);
    expect(selected).toEqual([rows()[4]]);
    const tag = i18n.t("athkar.session.current");
    expect(within(rows()[4]).getByText(tag)).toBeOnTheScreen();
    expect(rows()[4].props.accessibilityLabel).toContain(tag);
    expect(screen.getAllByText(tag, hidden)).toHaveLength(1);
  });

  it("selects no row for a finished session", async () => {
    await renderSheet({ index: null });
    expect(rows().some((row) => row.props.accessibilityState.selected)).toBe(false);
  });

  it("shows the text a group has reached", async () => {
    const group: SessionItem = {
      id: "group",
      target: 9,
      texts: [textOf(0, 0), textOf(0, 1), textOf(0, 2)].map(keyText),
      itemsPerRound: 3,
    };
    await renderSheet({ list: [group], counts: { group: 4 } });
    expect(within(rows()[0]).getByText(textOf(0, 1))).toBeOnTheScreen();
  });

  it("jumps to the pressed row, then closes", async () => {
    const onJump = jest.fn();
    const onClose = jest.fn();
    await renderSheet({ onJump, onClose });
    await userEvent.press(rows()[2]);
    expect(onJump).toHaveBeenCalledTimes(1);
    expect(onJump).toHaveBeenCalledWith(2);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onJump.mock.invocationCallOrder[0]).toBeLessThan(onClose.mock.invocationCallOrder[0]);
  });

  it("closes from its close control without a jump", async () => {
    const onJump = jest.fn();
    const onClose = jest.fn();
    await renderSheet({ onJump, onClose });
    await userEvent.press(screen.getByTestId(ACTIONSHEET_PART.CLOSE, hidden));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onJump).not.toHaveBeenCalled();
  });

  describe("opening at the current row", () => {
    const layOut = (row: number, y: number) =>
      fireEvent(rows()[row], "layout", { nativeEvent: { layout: { y } } });
    const settle = () => act(async () => settleSheet());

    beforeEach(() => holdSheetsRising(true));
    afterEach(() => holdSheetsRising(false));

    // gorhom snaps a rising sheet's list back to its top on every scroll.
    it("waits for the sheet to settle, then shows the row with two rows of lead", async () => {
      await renderSheet({ index: 8 });
      await layOut(8, ROW_Y);
      expect(mockScrollTo).not.toHaveBeenCalled();
      await settle();
      expect(mockScrollTo).toHaveBeenCalledTimes(1);
      expect(mockScrollTo).toHaveBeenCalledWith({
        y: ROW_Y - SESSION_LIST_LEAD_ROWS * SESSION_LIST_ROW_MIN_HEIGHT,
        animated: true,
      });
    });

    it("never scrolls above the top for an early current row", async () => {
      await renderSheet({ index: 1 });
      await layOut(1, 1);
      await settle();
      expect(mockScrollTo).toHaveBeenCalledWith({ y: 0, animated: true });
    });

    it("leaves the scroll alone when another row is laid out", async () => {
      await renderSheet({ index: 8 });
      await layOut(3, ROW_Y);
      await settle();
      expect(mockScrollTo).not.toHaveBeenCalled();
    });
  });
});
