import { StyleSheet } from "react-native";
import { act, screen, userEvent, waitFor } from "@testing-library/react-native";

const mockPush = jest.fn();
const mockBack = jest.fn();
type MockSaved = {
  id: number;
  source_athkar_id: number;
  source_category_id: number;
  user_count: number;
  sort_order: number;
};
/** The saved Hisn rows, as the table holds them. */
let mockSaved: MockSaved[] = [];
/** The counts a read of the day returns, by item id; none is zero. */
let mockDay: Record<number, number> = {};
/** The Hisn dhikr the topic's rows point to, and the topic's names. */
let mockTexts: { id: number; arabicText: string }[] = [];
let mockTopic = { titleAr: "", titleEn: "" };
/** The custom group's items, as the table holds them. */
let mockCustom: { id: number; target: number }[] = [];

jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush, back: mockBack }) }));
jest.mock("@/services/widgetSnapshot", () => ({ syncWidgetSnapshot: jest.fn(async () => {}) }));
// The real database is SQLite, which jest lacks.
jest.mock("@/services/athkar-db", () => ({
  AthkarDB: {
    initialize: jest.fn(async () => {}),
    updateMyAthkarDailyCount: jest.fn(async () => true),
    updateCustomAthkarDailyCount: jest.fn(async () => true),
    getMyAthkar: async () => mockSaved,
    removeFromMyAthkar: async (id: number) => {
      mockSaved = mockSaved.filter((row) => row.id !== id);
    },
    initializeMyAthkarDaily: jest.fn(async () => true),
    getMyAthkarDailyProgress: async () =>
      mockSaved.map((row) => ({
        my_athkar_id: row.id,
        current_count: mockDay[row.id] ?? 0,
        total_count: row.user_count,
      })),
    initializeCustomAthkarDaily: jest.fn(async () => true),
    getCustomAthkarDailyProgress: async () =>
      mockCustom.map(({ id, target }) => ({
        custom_item_id: id,
        current_count: mockDay[id] ?? 0,
        total_count: target,
      })),
  },
}));
jest.mock("@/services/hisn-muslim-db", () => ({
  HisnMuslimDB: {
    getAthkarByIds: async (ids: number[]) => mockTexts.filter((text) => ids.includes(text.id)),
    getCategoryForAthkar: async (ids: number[]) => new Map(ids.map((id) => [id, mockTopic])),
  },
}));
jest.mock("@/services/athkar-player", () => ({ athkarPlayer: {} }));
jest.mock("@/stores/location", () => ({
  __esModule: true,
  default: { getState: () => ({ locationDetails: { timezone: "Asia/Riyadh" } }) },
}));
jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => {}),
    removeItem: jest.fn(async () => {}),
  },
}));
jest.mock("@/utils/appLogger", () => ({
  AppLogger: { create: () => ({ i: jest.fn(), w: jest.fn(), e: jest.fn() }) },
}));
jest.mock("@/hooks/useHaptic", () => jest.requireActual("@/test-helpers/hapticMock"));
jest.mock("@/hooks/useInitializeAthkarStores", () => ({
  useInitializeAthkarStores: () => ({ isMyAthkarInit: true, isCustomInit: true }),
}));
jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("react-native-safe-area-context", () =>
  jest.requireActual("@/test-helpers/safeAreaMock")
);
// The header reads the navigator for a route back; this one is handled by the screen.
jest.mock("@/components/ui/screen-header/useBackDestination", () => ({
  useBackDestination: () => undefined,
}));
jest.mock("@/components/athkar/AudioOnboarding", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/athkar/looks/registry", () =>
  jest.requireActual("@/test-helpers/athkarLooks").registryWithTestLook()
);

/* eslint-disable import/first -- imports must follow jest.mock hoisting */
import {
  ATHKAR_FOCUS_SCREEN_PART,
  AthkarFocusScreen,
} from "@/components/athkar/session/AthkarFocusScreen";
import { COLLECTION_EDIT_PART } from "@/components/athkar/session/CollectionEditSheet";
import { CollectionSessionScreen } from "@/components/athkar/session/CollectionSessionScreen";
import { SESSION_DONE_ID } from "@/components/athkar/session/SessionDone";
import { SkyBackground } from "@/components/ui/sky-background";
import { customAthkarEditHref } from "@/constants/Athkar";
import {
  ATHKAR_LOOK,
  ATHKAR_LOOK_IDS,
  DEFAULT_ATHKAR_LOOK,
  type AthkarLookId,
} from "@/constants/AthkarLook";
import { ADVANCE_PAUSE_MS, SESSION_SOURCE, type CollectionSource } from "@/constants/AthkarSession";
import i18n from "@/localization/i18n";
import { useAthkarStore } from "@/stores/athkar";
import { collectionSession, useAthkarCollectionSession } from "@/stores/athkarCollectionSession";
import { useCustomAthkarStore } from "@/stores/custom-athkar";
import { useMyAthkarStore } from "@/stores/my-athkar";
import { TEST_LOOK_ID, TEST_LOOK_PART } from "@/test-helpers/athkarLooks";
import { controlProblems } from "@/test-helpers/controls";
import { renderWithTheme } from "@/test-helpers/theme";
import { focusHref } from "@/utils/athkarSessionSource";
/* eslint-enable import/first */

const t = i18n.t.bind(i18n);
const LOOKS = ATHKAR_LOOK_IDS.filter((id) => id !== TEST_LOOK_ID);
const CELEBRATION = /%|\p{Extended_Pictographic}/u;

const TOPIC = { id: 7, titleAr: "أذكار النوم", titleEn: "Before sleep" };
const HISN: CollectionSource = { kind: SESSION_SOURCE.HISN, categoryId: TOPIC.id };
const HISN_WORDS = ["باسمك اللهم أموت وأحيا", "اللهم قني عذابك", "سبحان الله وبحمده"];
const CUSTOM_WORDS = ["أستغفر الله", "سبحان الله"];
const GROUP = { id: 3, title: "After prayer" };
const TARGET = 2;
const ALL_DONE = HISN_WORDS.map(() => TARGET);
const CUSTOM: CollectionSource = { kind: SESSION_SOURCE.CUSTOM, groupId: GROUP.id };
/** A day long past: the counts in memory are not today's. */
const PAST_DAY = 20000101;
const hisnId = (index: number) => index + 11;
const customId = (index: number) => index + 30;

/** Both collections, with these counts by position on `day`; a count not given is zero. */
const seed = (counts: readonly number[] = [], day: number | null = null) => {
  const countAt = (index: number) => counts[index] ?? 0;
  const texts = HISN_WORDS.map((arabicText, i) => ({
    id: i + 1,
    categoryId: TOPIC.id,
    arabicText,
    transliteration: `said ${i + 1}`,
    translation: `meaning ${i + 1}`,
    repeatCount: TARGET,
    audioUrl: null,
    sortOrder: i,
  }));
  mockSaved = texts.map((text, i) => ({
    id: hisnId(i),
    source_athkar_id: text.id,
    source_category_id: TOPIC.id,
    user_count: TARGET,
    sort_order: i,
  }));
  mockTexts = texts;
  mockTopic = { titleAr: TOPIC.titleAr, titleEn: TOPIC.titleEn };
  mockCustom = CUSTOM_WORDS.map((_, i) => ({ id: customId(i), target: TARGET }));
  mockDay = {};

  useMyAthkarStore.setState({
    isInitialized: true,
    progressDay: day,
    items: mockSaved.map((row) => ({
      id: row.id,
      sourceAthkarId: row.source_athkar_id,
      sourceCategoryId: row.source_category_id,
      userCount: row.user_count,
      sortOrder: row.sort_order,
    })),
    displayData: new Map(
      texts.map((text) => [
        text.id,
        { ...text, categoryTitleAr: TOPIC.titleAr, categoryTitleEn: TOPIC.titleEn },
      ])
    ),
    progress: HISN_WORDS.map((_, i) => ({
      myAthkarId: hisnId(i),
      currentCount: countAt(i),
      totalCount: TARGET,
      completed: countAt(i) >= TARGET,
    })),
  });
  useCustomAthkarStore.setState({
    isInitialized: true,
    progressDay: day,
    groups: [{ id: GROUP.id, title: GROUP.title, sortOrder: 0 }],
    items: CUSTOM_WORDS.map((arabicText, i) => ({
      id: customId(i),
      groupId: GROUP.id,
      arabicText,
      userCount: TARGET,
      sortOrder: i,
    })),
    progress: CUSTOM_WORDS.map((_, i) => ({
      customItemId: customId(i),
      currentCount: countAt(i),
      totalCount: TARGET,
      completed: countAt(i) >= TARGET,
    })),
  });
};

const COLLECTIONS = [
  { name: "a saved topic", source: HISN, title: TOPIC.titleEn, words: HISN_WORDS },
  { name: "a custom group", source: CUSTOM, title: GROUP.title, words: CUSTOM_WORDS },
] as const;

const mockOnBack = jest.fn();
const renderReader = (source: CollectionSource, title: string) =>
  renderWithTheme(
    <SkyBackground>
      <CollectionSessionScreen source={source} title={title} onBack={mockOnBack} />
    </SkyBackground>
  );
const renderFocus = (source: CollectionSource) =>
  renderWithTheme(
    <SkyBackground>
      <AthkarFocusScreen source={source} />
    </SkyBackground>
  );
type Settings = ReturnType<typeof useAthkarStore.getState>["settings"];
const useSettings = (settings: Partial<Settings>) =>
  useAthkarStore.setState((s) => ({ settings: { ...s.settings, ...settings } }));
const useLook = (look: AthkarLookId) => useSettings({ look });

beforeEach(() => {
  jest.clearAllMocks();
  useAthkarCollectionSession.setState({ places: {}, pending: null });
  useSettings({ look: DEFAULT_ATHKAR_LOOK, autoMoveToNext: true, showTranslation: true });
  seed();
});

describe.each(COLLECTIONS)("$name as a session", ({ source, title, words }) => {
  test.each(LOOKS)("the %s look reads its first dhikr under its name", async (look) => {
    useLook(look);
    await renderReader(source, title);

    expect(screen.getByRole("header", { name: title })).toBeOnTheScreen();
    expect(screen.getAllByText(words[0]).length).toBeGreaterThan(0);
  });

  test.each(LOOKS)("the %s look offers no audio session", async (look) => {
    useLook(look);
    await renderReader(source, title);
    expect(screen.queryByRole("button", { name: t("a11y.athkar.startAudioSession") })).toBeNull();
  });

  test("counting a dhikr to its target opens the next after the pause", async () => {
    jest.useFakeTimers();
    useLook(TEST_LOOK_ID);
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await renderReader(source, title);

    await user.press(screen.getByTestId(TEST_LOOK_PART.READER));
    await user.press(screen.getByTestId(TEST_LOOK_PART.READER));
    expect(screen.getByTestId(TEST_LOOK_PART.COUNT)).toHaveTextContent(String(TARGET));

    await act(() => jest.advanceTimersByTime(ADVANCE_PAUSE_MS));
    expect(screen.getByTestId(TEST_LOOK_PART.COUNT)).toHaveTextContent("0");
    jest.useRealTimers();
  });

  test("a finished collection says so, with no celebration", async () => {
    seed(ALL_DONE);
    await renderReader(source, title);

    const done = screen.getByTestId(SESSION_DONE_ID);
    expect(done).toHaveTextContent(t("athkar.session.collectionDone"));
    expect(done).not.toHaveTextContent(CELEBRATION);
  });

  test("opened on a new day, it reads that day's counts", async () => {
    seed(ALL_DONE, PAST_DAY);
    await renderReader(source, title);

    await waitFor(() => expect(screen.queryByTestId(SESSION_DONE_ID)).toBeNull());
    expect(screen.getAllByText(words[0]).length).toBeGreaterThan(0);
  });

  test("back returns to My Athkar", async () => {
    const user = userEvent.setup();
    await renderReader(source, title);

    await user.press(
      screen.getByRole("button", { name: t("a11y.backTo", { screen: t("athkar.myAthkar") }) })
    );
    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });

  test("Focus opens on the same collection", async () => {
    const user = userEvent.setup();
    useLook(ATHKAR_LOOK.CLASSIC);
    await renderReader(source, title);

    await user.press(
      screen.getByRole("button", { name: new RegExp(t("athkar.session.focus.title")) })
    );
    expect(mockPush).toHaveBeenCalledWith(focusHref(source));
  });

  test.each(LOOKS)(
    "the %s look's Focus shows its dhikr, centred under its name, with no audio control",
    async (look) => {
      useLook(look);
      await renderFocus(source);

      expect(screen.getAllByText(words[0]).length).toBeGreaterThan(0);
      expect(screen.getByText(title)).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: t("a11y.athkar.startAudioSession") })).toBeNull();
      // The title sits between two controls' widths.
      expect(screen.getByTestId(ATHKAR_FOCUS_SCREEN_PART.NO_AUDIO)).toHaveStyle({
        width: StyleSheet.flatten(
          screen.getByRole("button", { name: t("a11y.athkar.focus.close") }).props.style
        ).width,
      });
    }
  );

  test("Focus keeps the reader's place on a finished dhikr", async () => {
    useSettings({ autoMoveToNext: false });
    seed([TARGET]);
    await act(() => collectionSession.jumpTo(source, 0));
    const place = useAthkarCollectionSession.getState().places;
    await renderFocus(source);

    expect(screen.getAllByText(words[0]).length).toBeGreaterThan(0);
    expect(useAthkarCollectionSession.getState().places).toEqual(place);
  });

  test("every control is named and has a full target", async () => {
    await renderReader(source, title);
    expect(controlProblems()).toEqual([]);
  });
});

describe("a saved topic's edit sheet", () => {
  const openSheet = async () => {
    const user = userEvent.setup();
    await renderReader(HISN, TOPIC.titleEn);
    await user.press(screen.getByRole("button", { name: t("athkar.collection.edit") }));
    return user;
  };
  const rows = () => screen.queryAllByTestId(COLLECTION_EDIT_PART.ROW);

  test("lists the topic's dhikr", async () => {
    await openSheet();
    expect(screen.getByText(t("athkar.collection.edit"))).toBeOnTheScreen();
    expect(rows()).toHaveLength(HISN_WORDS.length);
  });

  test("a row names its dhikr as the session's list does", async () => {
    await openSheet();
    expect(rows()[0]).toHaveTextContent("meaning 1");
    expect(rows()[0]).toHaveProp("accessibilityLabel", "meaning 1");
  });

  test("a row's remove control takes that dhikr out of the collection", async () => {
    const user = await openSheet();
    await user.press(
      screen.getByRole("button", { name: t("a11y.athkar.removeDhikr", { number: 2 }) })
    );

    await waitFor(() => expect(rows()).toHaveLength(HISN_WORDS.length - 1));
    expect(rows().map((row) => row.props.accessibilityLabel)).toEqual(["meaning 1", "meaning 3"]);
  });

  test("removing a dhikr before the place keeps the place on its dhikr", async () => {
    // Each dhikr's count tells the place apart under the test look.
    seed([0, 1, 0]);
    mockDay = { [hisnId(1)]: 1 };
    useLook(TEST_LOOK_ID);
    await act(() => collectionSession.jumpTo(HISN, 1));
    const user = await openSheet();
    // The reader sits under the open sheet.
    const count = () => screen.getByTestId(TEST_LOOK_PART.COUNT, { includeHiddenElements: true });
    expect(count()).toHaveTextContent("1");

    await user.press(
      screen.getByRole("button", { name: t("a11y.athkar.removeDhikr", { number: 1 }) })
    );

    await waitFor(() => expect(rows()).toHaveLength(HISN_WORDS.length - 1));
    expect(count()).toHaveTextContent("1");
  });

  test("a row opens the dhikr with how it is said and what it means", async () => {
    const user = await openSheet();
    await user.press(rows()[1]);

    expect(screen.getByTestId(COLLECTION_EDIT_PART.DETAIL)).toBeOnTheScreen();
    expect(screen.getByText("said 2")).toBeOnTheScreen();
    expect(screen.getByText("meaning 2")).toBeOnTheScreen();

    await user.press(screen.getByRole("button", { name: t("common.back") }));
    expect(screen.queryByTestId(COLLECTION_EDIT_PART.DETAIL)).toBeNull();
  });
});

test("a custom group's action opens its editor", async () => {
  const user = userEvent.setup();
  await renderReader(CUSTOM, GROUP.title);
  await user.press(screen.getByRole("button", { name: t("athkar.collection.edit") }));
  expect(mockPush).toHaveBeenCalledWith(customAthkarEditHref(GROUP.id));
});

test("Focus on a collection that is gone says it could not load, under the way out", async () => {
  useCustomAthkarStore.setState({ groups: [], items: [], progress: [] });
  await renderFocus(CUSTOM);

  expect(screen.getByRole("button", { name: t("a11y.athkar.focus.close") })).toBeOnTheScreen();
  expect(screen.getByText(t("athkar.session.loadError.title"))).toBeOnTheScreen();
  expect(screen.queryByTestId(SESSION_DONE_ID)).toBeNull();
});
