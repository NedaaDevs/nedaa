// First: expo-router's testing library re-mocks Reanimated as it loads, and
// the screens must bind to the mock below, not to its empty one.
import QadaHome from "@/app/(tabs)/qada";
import QadaBatches from "@/app/qada-batches";
import { AccessibilityInfo, Text } from "react-native";
import { usePathname } from "expo-router";
import { act, fireEvent, render, userEvent } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AddBatchSheet } from "@/components/Qada/AddBatchSheet";
import { A11Y_ACTION } from "@/constants/Accessibility";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { QADA_ENTRY_STATUS, QADA_ENTRY_TYPE } from "@/constants/Qada";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { QadaDB, type QadaHistory } from "@/services/qada-db";
import { useAppStore } from "@/stores/app";
import { useQadaStore } from "@/stores/qada";
import { controlProblems } from "@/test-helpers/controls";
import { ThemeProvider } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
// hijri-native is a native module; each UTC day maps to its own Hijri day.
jest.mock("@/utils/date", () => ({
  ...jest.requireActual("@/utils/date"),
  HijriNative: {
    fromTimestamp: (seconds: number) => ({
      year: 1448,
      month: 2,
      day: new Date(seconds * 1000).getUTCDate(),
    }),
    addDays: (date: { day: number }, days: number) => ({ ...date, day: date.day + days }),
  },
}));
jest.mock("@/services/qada-db", () => {
  const actual = jest.requireActual("@/services/qada-db");
  return {
    ...actual,
    QadaDB: { ...actual.QadaDB, getCompletions: jest.fn(), getNewestCompletionId: jest.fn() },
  };
});

const t = i18n.t.bind(i18n);
const DAY_MS = 86_400_000;
const isoDaysAgo = (days: number) => new Date(Date.now() - days * DAY_MS).toISOString();

const row = (fields: Partial<QadaHistory> & Pick<QadaHistory, "id" | "count">): QadaHistory => ({
  type: QADA_ENTRY_TYPE.ADDED,
  status: QADA_ENTRY_STATUS.PENDING,
  created_at: isoDaysAgo(10),
  updated_at: isoDaysAgo(1),
  ...fields,
});

const OLDER = row({ id: 1, count: 3, notes: "Ramadan 1446", created_at: isoDaysAgo(40) });
const NEWER = row({ id: 2, count: 2, created_at: isoDaysAgo(5) });
const DONE = row({ id: 3, count: 2, notes: "Travel", status: QADA_ENTRY_STATUS.COMPLETED });
const COMPLETION = row({
  id: 9,
  count: 1,
  type: QADA_ENTRY_TYPE.COMPLETED,
  created_at: isoDaysAgo(2),
});

/** The ledger id the record button's write returns. */
const RECORDED_ID = 42;

const completeEntry = jest.fn(async (): Promise<number | null> => RECORDED_ID);
const restoreDay = jest.fn(async () => true);
const addMissed = jest.fn(async () => true);
const completeSpecificEntry = jest.fn(async () => true);

const seed = (history: QadaHistory[], totals: { missed: number; completed: number }) => {
  const pending = history.filter(({ status }) => status === QADA_ENTRY_STATUS.PENDING);
  useQadaStore.setState({
    history,
    pendingEntries: pending,
    writes: 0,
    totalMissed: totals.missed,
    totalCompleted: totals.completed,
    totalOriginal: totals.missed + totals.completed,
    completeEntry,
    restoreDay,
    addMissed,
    completeSpecificEntry,
  });
};

const Pathname = () => <Text testID="pathname">{usePathname()}</Text>;

const renderAt = (href: string) =>
  renderRouter(
    {
      [BACK_DESTINATION.QADA.route]: () => (
        <>
          <QadaHome />
          <Pathname />
        </>
      ),
      [BACK_DESTINATION.QADA_BATCHES.route]: () => (
        <>
          <QadaBatches />
          <Pathname />
        </>
      ),
    },
    { initialUrl: href, wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider> }
  );

const renderHome = () => renderAt(BACK_DESTINATION.QADA.href as string);
const renderBatches = () => renderAt(BACK_DESTINATION.QADA_BATCHES.href as string);

const undoButton = () => screen.queryByRole("button", { name: t("athkar.session.undo") });
const recordButton = () => screen.getByRole("button", { name: t("qada.home.record") });

describe("Qada home", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAppStore.setState({ locale: AppLocale.EN });
    jest.mocked(QadaDB.getCompletions).mockResolvedValue([COMPLETION]);
    jest.mocked(QadaDB.getNewestCompletionId).mockResolvedValue(RECORDED_ID);
  });
  afterEach(() => act(() => i18n.changeLanguage(AppLocale.EN)));

  it("leads with the days remaining and what is completed", async () => {
    seed([NEWER, OLDER], { missed: 5, completed: 2 });
    await renderHome();

    expect(screen.getByRole("header", { name: t("qada.home.title") })).toBeTruthy();
    expect(
      screen.getByLabelText(
        t("a11y.join", {
          first: t("qada.home.remainingLabel"),
          second: t("qada.days", { count: 5 }),
        })
      )
    ).toBeTruthy();
    expect(screen.getByText(t("qada.home.completedOf", { count: 7, completed: 2 }))).toBeTruthy();
    expect(controlProblems()).toEqual([]);
  });

  it("leaves the completed line out while nothing is completed", async () => {
    seed([OLDER], { missed: 3, completed: 0 });
    await renderHome();

    expect(screen.queryByText(t("qada.home.completedOf", { count: 3, completed: 0 }))).toBeNull();
  });

  it("records a day off the oldest open batch and undoes that very day", async () => {
    seed([NEWER, OLDER], { missed: 5, completed: 2 });
    await renderHome();

    await userEvent.press(recordButton());

    expect(completeEntry).toHaveBeenCalledWith(OLDER.id);
    expect(screen.getByText(OLDER.notes!)).toBeTruthy();

    await userEvent.press(undoButton()!);

    expect(restoreDay).toHaveBeenCalledWith(RECORDED_ID);
    expect(undoButton()).toBeNull();
  });

  it("says the day came back and moves focus to the record button", async () => {
    const focus = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent");
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
    seed([NEWER, OLDER], { missed: 5, completed: 2 });
    await renderHome();
    await userEvent.press(recordButton());

    await userEvent.press(undoButton()!);

    expect(announce).toHaveBeenLastCalledWith(t("a11y.qada.dayReturned"));
    expect(focus).toHaveBeenCalledWith(expect.anything(), "focus");
  });

  it("names the batch it recorded from after the batch is gone", async () => {
    seed([NEWER, OLDER], { missed: 5, completed: 2 });
    await renderHome();
    await userEvent.press(recordButton());

    await act(() => useQadaStore.setState({ history: [NEWER], pendingEntries: [NEWER] }));

    expect(screen.getByText(OLDER.notes!)).toBeTruthy();
  });

  it("drops the undo after any other write, even one that leaves the totals", async () => {
    seed([NEWER, OLDER], { missed: 5, completed: 2 });
    await renderHome();
    await userEvent.press(recordButton());
    expect(undoButton()).toBeTruthy();

    await act(() => useQadaStore.setState((state) => ({ writes: state.writes + 1 })));

    expect(undoButton()).toBeNull();
  });

  it("restores nothing once a newer day is recorded", async () => {
    jest.mocked(QadaDB.getNewestCompletionId).mockResolvedValue(RECORDED_ID + 1);
    seed([NEWER, OLDER], { missed: 5, completed: 2 });
    await renderHome();
    await userEvent.press(recordButton());

    await userEvent.press(undoButton()!);

    expect(restoreDay).not.toHaveBeenCalled();
    expect(undoButton()).toBeNull();
  });

  it("offers no undo when nothing was recorded", async () => {
    completeEntry.mockResolvedValueOnce(null);
    seed([NEWER, OLDER], { missed: 5, completed: 2 });
    await renderHome();

    await userEvent.press(recordButton());

    expect(undoButton()).toBeNull();
  });

  it("counts open batches that the history does not hold", async () => {
    useQadaStore.setState({
      history: [],
      pendingEntries: [OLDER],
      totalMissed: 3,
      totalCompleted: 0,
      totalOriginal: 3,
      completeEntry,
      writes: 0,
    });
    await renderHome();

    await userEvent.press(recordButton());

    expect(screen.getByText(OLDER.notes!)).toBeTruthy();
  });

  it("draws two days in Arabic as the dual alone", async () => {
    useAppStore.setState({ locale: AppLocale.AR });
    await act(() => i18n.changeLanguage(AppLocale.AR));
    seed([NEWER], { missed: 2, completed: 0 });
    await renderHome();

    expect(screen.getByText(t("qada.home.remainingUnit", { count: 2 }))).toBeTruthy();
    expect(screen.queryByText(/^[2٢]$/)).toBeNull();
  });

  it("keeps the figure beside the unit for other counts", async () => {
    seed([NEWER, OLDER], { missed: 5, completed: 2 });
    await renderHome();

    const figure = screen.getByText("5");
    expect(figure.props).toMatchObject({ numberOfLines: 1, adjustsFontSizeToFit: true });
    expect(screen.getByText(t("qada.home.remainingUnit", { count: 5 }))).toBeTruthy();
  });

  it("opens the batches from its one row", async () => {
    seed([NEWER, OLDER], { missed: 5, completed: 2 });
    await renderHome();

    await userEvent.press(screen.getByRole("button", { name: /^Your open batches/ }));

    expect(screen.getByTestId("pathname")).toHaveTextContent(
      BACK_DESTINATION.QADA_BATCHES.href as string
    );
  });

  it("asks for a first batch while there is none", async () => {
    seed([], { missed: 0, completed: 0 });
    await renderHome();

    expect(screen.getByText(t("qada.home.emptyTitle"))).toBeTruthy();
    expect(screen.queryByRole("button", { name: t("qada.home.record") })).toBeNull();

    await userEvent.press(screen.getByRole("button", { name: t("qada.home.addBatch") }));

    expect(screen.getByText(t("qada.addBatch.title"))).toBeTruthy();
  });

  it("adds a batch from the sheet, with a quick size and a note", async () => {
    seed([], { missed: 0, completed: 0 });
    await renderHome();
    await userEvent.press(screen.getByRole("button", { name: t("qada.home.addBatch") }));

    await userEvent.press(screen.getByRole("button", { name: t("qada.days", { count: 3 }) }));
    expect(
      screen.getByRole("button", { name: t("qada.days", { count: 3 }) }).props.accessibilityState
    ).toMatchObject({ selected: true });
    await userEvent.press(screen.getByRole("button", { name: /^Add a note/ }));
    await userEvent.type(screen.getByLabelText(t("qada.notes")), "Travel");
    await userEvent.press(screen.getByRole("button", { name: t("qada.addBatch.submit") }));

    expect(addMissed).toHaveBeenCalledWith(3, "Travel");
  });

  it("adds one batch however fast the button is pressed", async () => {
    let finish = (_added: boolean) => {};
    addMissed.mockImplementationOnce(() => new Promise<boolean>((resolve) => (finish = resolve)));
    seed([], { missed: 0, completed: 0 });
    await renderHome();
    await userEvent.press(screen.getByRole("button", { name: t("qada.home.addBatch") }));

    const submit = screen.getByRole("button", { name: t("qada.addBatch.submit") });
    await userEvent.press(submit);
    await userEvent.press(submit);
    await act(async () => finish(true));

    expect(addMissed).toHaveBeenCalledTimes(1);
  });

  it("meets the control checklist with the add sheet open", async () => {
    seed([], { missed: 0, completed: 0 });
    await renderHome();
    await userEvent.press(screen.getByRole("button", { name: t("qada.home.addBatch") }));

    // The scrim fills the screen; under jest it has no frame to measure.
    const scrim = `${t("a11y.dismiss")}: under 44pt`;
    expect(controlProblems().filter((problem) => problem !== scrim)).toEqual([]);
  });

  it("says plainly that nothing remains", async () => {
    seed([DONE], { missed: 0, completed: 2 });
    await renderHome();

    expect(screen.getByText(t("qada.home.doneTitle"))).toBeTruthy();
    expect(screen.getByText(t("qada.home.completedOf", { count: 2, completed: 2 }))).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Batches and history/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: t("qada.home.addBatch") })).toBeTruthy();
    expect(screen.queryByRole("button", { name: t("qada.home.record") })).toBeNull();
  });
});

describe("Qada batches", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAppStore.setState({ locale: AppLocale.EN });
    jest.mocked(QadaDB.getCompletions).mockResolvedValue([COMPLETION]);
  });

  const removeHint = (count: number) => t("a11y.qada.returnDaysHint", { count });

  it("lists every batch, oldest first, and opens an open one's actions", async () => {
    seed([DONE, NEWER, OLDER], { missed: 5, completed: 2 });
    await renderBatches();

    const open = screen.getAllByRole("button", { name: /Ramadan 1446|Separate days/ });
    expect(open.map((button) => button.props.accessibilityLabel.split(",")[0])).toEqual([
      OLDER.notes,
      t("qada.batch.unnamed"),
    ]);
    expect(open[0].props.accessibilityHint).toBe(t("a11y.qada.batchActionsHint"));
    expect(screen.queryByRole("button", { name: new RegExp(DONE.notes!) })).toBeNull();
    expect(screen.queryByRole("header", { name: DONE.notes! })).toBeNull();
    expect(screen.getByLabelText(new RegExp(`^${DONE.notes}, `))).toBeTruthy();

    await userEvent.press(open[0]);

    expect(screen.getByRole("button", { name: t("common.complete") })).toBeTruthy();
    const all = `${t("common.all")} (${OLDER.count})`;
    await userEvent.press(screen.getByRole("button", { name: all }));
    expect(completeSpecificEntry).toHaveBeenCalledWith(OLDER.id);
  });

  it("returns a recorded day through the row's remove action", async () => {
    seed([NEWER, OLDER], { missed: 5, completed: 2 });
    await renderBatches();

    const day = await screen.findByHintText(removeHint(COMPLETION.count));
    await act(() =>
      fireEvent(day, "accessibilityAction", { nativeEvent: { actionName: A11Y_ACTION.REMOVE } })
    );

    expect(restoreDay).toHaveBeenCalledWith(COMPLETION.id);
  });

  it("says so when no day is recorded yet", async () => {
    jest.mocked(QadaDB.getCompletions).mockResolvedValue([]);
    seed([OLDER], { missed: 3, completed: 0 });
    await renderBatches();

    expect(await screen.findByText(t("qada.noHistory"))).toBeTruthy();
  });

  it("meets the control checklist", async () => {
    seed([DONE, NEWER, OLDER], { missed: 5, completed: 2 });
    await renderBatches();
    await screen.findByHintText(removeHint(COMPLETION.count));

    expect(controlProblems()).toEqual([]);
  });
});

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

describe("the add sheet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAppStore.setState({ locale: AppLocale.EN });
    seed([], { missed: 0, completed: 0 });
  });

  // The sheet stays on screen while it slides away, and its button still takes taps.
  it("adds nothing more while it closes", async () => {
    await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <ThemeProvider>
          <AddBatchSheet open onClose={jest.fn()} />
        </ThemeProvider>
      </SafeAreaProvider>
    );
    const submit = screen.getByRole("button", { name: t("qada.addBatch.submit") });

    await userEvent.press(submit);
    await userEvent.press(submit);

    expect(addMissed).toHaveBeenCalledTimes(1);
  });

  it("adds again once it opens again", async () => {
    const sheet = (open: boolean) => (
      <SafeAreaProvider initialMetrics={METRICS}>
        <ThemeProvider>
          <AddBatchSheet open={open} onClose={jest.fn()} />
        </ThemeProvider>
      </SafeAreaProvider>
    );
    const { rerender } = await render(sheet(true));
    await userEvent.press(screen.getByRole("button", { name: t("qada.addBatch.submit") }));

    await act(() => rerender(sheet(false)));
    await act(() => rerender(sheet(true)));
    await userEvent.press(screen.getByRole("button", { name: t("qada.addBatch.submit") }));

    expect(addMissed).toHaveBeenCalledTimes(2);
  });
});
