import { AccessibilityInfo } from "react-native";
import { act, screen, userEvent, waitFor } from "@testing-library/react-native";

import AthkarSearchSheet from "@/components/athkar/AthkarSearchSheet";
import { MessageToast } from "@/components/feedback";
import { ROLE_RATIO } from "@/components/ui/text/sizing";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { HisnMuslimDB } from "@/services/hisn-muslim-db";
import { useAppStore } from "@/stores/app";
import { useMyAthkarStore } from "@/stores/my-athkar";
import { useBottomSheetModal } from "@/test-helpers/bottomSheetMock";
import { controlProblems } from "@/test-helpers/controls";
import { layOut } from "@/test-helpers/layout";
import { later } from "@/test-helpers/promises";
import { lineRatioOf } from "@/test-helpers/text";
import { renderWithTheme } from "@/test-helpers/theme";
import type { HisnAthkar, HisnCategory, HisnSearchResult } from "@/types/hisnMuslim";
import { PREVIEW_ELLIPSIS } from "@/utils/previewText";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("react-native-safe-area-context", () =>
  jest.requireActual("@/test-helpers/safeAreaMock")
);
jest.mock("@/hooks/useHaptic", () => jest.requireActual("@/test-helpers/hapticMock"));
jest.mock("@/components/feedback", () => ({
  MessageToast: { showSuccess: jest.fn(), showError: jest.fn() },
}));
jest.mock("@/services/hisn-muslim-db", () => ({
  HisnMuslimDB: { getCategories: jest.fn(), search: jest.fn(), getCategoryAthkar: jest.fn() },
}));
jest.mock("@/utils/appLogger", () => ({
  AppLogger: { create: () => ({ i: jest.fn(), w: jest.fn(), e: jest.fn() }) },
}));

const t = i18n.t.bind(i18n);

const SLEEP: HisnCategory = {
  id: 7,
  titleAr: "أذكار النوم",
  titleEn: "Before sleep",
  audioUrl: null,
};
const TRAVEL: HisnCategory = { id: 9, titleAr: "دعاء السفر", titleEn: "Travel", audioUrl: null };

const dhikr = (id: number, arabicText: string, translation: string, repeatCount = 1) =>
  ({
    id,
    categoryId: SLEEP.id,
    arabicText,
    transliteration: "",
    translation,
    repeatCount,
    audioUrl: null,
    sortOrder: id,
  }) satisfies HisnAthkar;

const BISMIKA = dhikr(1, "باسمك ربي وضعت جنبي", "In Your name, my Lord, I lie down");
const TASBIH = dhikr(2, "سبحان الله", "Glory be to Allah", 33);
const found = (item: HisnAthkar): HisnSearchResult => ({
  ...item,
  categoryTitleAr: SLEEP.titleAr,
  categoryTitleEn: SLEEP.titleEn,
});

const batchAddItems = jest.fn(async () => true);

const open = (onClose: () => void = () => {}) =>
  renderWithTheme(<AthkarSearchSheet isOpen onClose={onClose} />);

/** Waits out the search's settle delay. */
const settle = () => act(() => jest.advanceTimersByTimeAsync(400));

const field = () => screen.getByPlaceholderText(t("athkar.myAthkar.search"));
const failedPanel = () => screen.queryByText(t("athkar.library.loadFailed.title"));
const retry = () => screen.getByRole("button", { name: t("common.retry") });
const READ_FAILED = new Error("read failed");

// jest's View mock hands a ref its component, props included.
const focusEvent = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent");
const lastFocused = () => {
  const [node] = focusEvent.mock.lastCall ?? [];
  const props = (node as { props?: { accessibilityLabel?: string; children?: unknown } })?.props;
  return props?.accessibilityLabel ?? props?.children;
};
const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");

beforeEach(() => {
  jest.useFakeTimers();
  jest.mocked(HisnMuslimDB.getCategories).mockResolvedValue([SLEEP, TRAVEL]);
  jest.mocked(HisnMuslimDB.getCategoryAthkar).mockResolvedValue([BISMIKA, TASBIH]);
  jest.mocked(HisnMuslimDB.search).mockResolvedValue([found(BISMIKA), found(TASBIH)]);
  batchAddItems.mockClear();
  focusEvent.mockClear();
  announce.mockClear();
  jest.mocked(MessageToast.showSuccess).mockClear();
  jest.mocked(MessageToast.showError).mockClear();
  useMyAthkarStore.setState({ items: [], batchAddItems });
});
afterEach(async () => {
  jest.useRealTimers();
  useAppStore.setState({ locale: AppLocale.EN });
  await act(() => i18n.changeLanguage(AppLocale.EN));
});

describe("AthkarSearchSheet", () => {
  it("hands a close from the sheet to the parent", async () => {
    const onClose = jest.fn();
    await open(onClose);

    await act(() => useBottomSheetModal().dismiss());

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // The parent may keep the sheet mounted and only flip isOpen later, so the
  // reset happens in the close itself.
  it("clears the search as part of closing, before the parent reacts", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const view = await open();
    await user.type(field(), "sleep");

    await act(() => useBottomSheetModal().dismiss());
    await view.rerender(<AthkarSearchSheet isOpen={false} onClose={() => {}} />);
    await view.rerender(<AthkarSearchSheet isOpen onClose={() => {}} />);

    expect(field().props.value).toBe("");
  });

  it("browses a topic's athkar and returns to every topic", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await open();

    await user.press(await screen.findByRole("button", { name: SLEEP.titleEn }));

    expect(await screen.findByRole("checkbox", { name: new RegExp(BISMIKA.translation) }));
    await user.press(screen.getByRole("button", { name: t("athkar.library.allTopics") }));
    expect(screen.getByRole("button", { name: TRAVEL.titleEn })).toBeOnTheScreen();
  });

  it("finds athkar by an Arabic query and shows the Arabic text", async () => {
    useAppStore.setState({ locale: AppLocale.AR });
    await act(() => i18n.changeLanguage(AppLocale.AR));
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await open();

    await user.type(field(), "سبحان");
    await settle();

    expect(HisnMuslimDB.search).toHaveBeenLastCalledWith("سبحان");
    expect(screen.getByText(TASBIH.arabicText)).toBeOnTheScreen();
    expect(screen.getByText(new RegExp(t("athkar.library.repeats", { count: 33 })))).toBeTruthy();
    expect(screen.queryByText(TASBIH.translation)).toBeNull();
  });

  it("sets a long vowelled preview on its own line box, cut after a word", async () => {
    const kursi = dhikr(
      71,
      "﴿اللَّهُ لاَ إِلَهَ إِلاَّ هُوَ الْحَيُّ الْقَيُّومُ لاَ تَأْخُذُهُ سِنَةٌ وَلاَ نَوْمٌ لَّهُ مَا فِي السَّمَوَاتِ وَمَا فِي الأَرْضِ مَن ذَا الَّذِي يَشْفَعُ عِنْدَهُ إِلاَّ بِإِذْنِهِ",
      "Allah, there is no god but He"
    );
    jest.mocked(HisnMuslimDB.search).mockResolvedValue([found(kursi)]);
    useAppStore.setState({ locale: AppLocale.AR });
    await act(() => i18n.changeLanguage(AppLocale.AR));
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await open();

    await user.type(field(), "الكرسي");
    await settle();

    const preview = screen.getByText(new RegExp(`${PREVIEW_ELLIPSIS}$`));
    const kept = String(preview.props.children).slice(0, -PREVIEW_ELLIPSIS.length);
    expect(kursi.arabicText.startsWith(kept)).toBe(true);
    expect(kursi.arabicText[kept.length]).toBe(" ");
    expect(lineRatioOf(preview)).toBeGreaterThanOrEqual(ROLE_RATIO.vowelled);
  });

  it("finds athkar by an English query and shows the translation", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await open();

    await user.type(field(), "glory");
    await settle();

    expect(HisnMuslimDB.search).toHaveBeenLastCalledWith("glory");
    expect(screen.getByText(TASBIH.translation)).toBeOnTheScreen();
    expect(screen.getAllByText(`${t("athkar.library.repeats", { count: 33 })} · ${SLEEP.titleEn}`));
  });

  it("drops a search that lands after the field is cleared", async () => {
    let land: (rows: HisnSearchResult[]) => void = () => {};
    jest.mocked(HisnMuslimDB.search).mockImplementation(() => new Promise((done) => (land = done)));
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await open();
    await user.type(field(), "sleep");
    await settle();

    await user.clear(field());
    await act(async () => land([found(BISMIKA)]));

    expect(screen.queryByText(BISMIKA.translation)).toBeNull();
    expect(screen.getByText(t("athkar.library.browse"))).toBeOnTheScreen();
  });

  it("drops a search that lands after the sheet is closed", async () => {
    let land: (rows: HisnSearchResult[]) => void = () => {};
    jest.mocked(HisnMuslimDB.search).mockImplementation(() => new Promise((done) => (land = done)));
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const view = await open();
    await user.type(field(), "sleep");
    await settle();

    await act(() => useBottomSheetModal().dismiss());
    await act(async () => land([found(BISMIKA)]));
    await view.rerender(<AthkarSearchSheet isOpen={false} onClose={() => {}} />);
    await view.rerender(<AthkarSearchSheet isOpen onClose={() => {}} />);

    expect(screen.queryByText(BISMIKA.translation)).toBeNull();
    expect(screen.getByText(t("athkar.library.browse"))).toBeOnTheScreen();
  });

  it("keeps the add button in place as the choice changes", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await open();
    await user.type(field(), "sleep");
    await settle();

    const [first, second] = screen.getAllByRole("checkbox");
    await user.press(first);
    const add = screen.getByRole("button", { name: t("athkar.library.addSelected", { count: 1 }) });
    await user.press(second);

    expect(
      screen.getByRole("button", { name: t("athkar.library.addSelected", { count: 2 }) })
    ).toBe(add);
  });

  it("says when nothing matches", async () => {
    jest.mocked(HisnMuslimDB.search).mockResolvedValue([]);
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await open();

    await user.type(field(), "zzz");
    await settle();

    expect(screen.getByText(t("athkar.myAthkar.noResults"))).toBeOnTheScreen();
  });

  it("adds the chosen athkar once, however often the button is pressed", async () => {
    let finish: (ok: boolean) => void = () => {};
    batchAddItems.mockImplementation(() => new Promise<boolean>((done) => (finish = done)));
    const onClose = jest.fn();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await open(onClose);
    await user.type(field(), "sleep");
    await settle();

    expect(
      screen.queryByRole("button", { name: t("athkar.library.addSelected", { count: 2 }) })
    ).toBeNull();
    for (const box of screen.getAllByRole("checkbox")) await user.press(box);
    const add = screen.getByRole("button", { name: t("athkar.library.addSelected", { count: 2 }) });
    await user.press(add);
    await user.press(add);
    await act(async () => finish(true));

    expect(batchAddItems).toHaveBeenCalledTimes(1);
    expect(batchAddItems).toHaveBeenCalledWith([
      { sourceAthkarId: BISMIKA.id, sourceCategoryId: SLEEP.id, repeatCount: 1 },
      { sourceAthkarId: TASBIH.id, sourceCategoryId: SLEEP.id, repeatCount: 33 },
    ]);
    expect(MessageToast.showSuccess).toHaveBeenCalledWith(t("athkar.library.added", { count: 2 }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("keeps the choice and says so when adding fails", async () => {
    batchAddItems.mockResolvedValue(false);
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await open();
    await user.type(field(), "sleep");
    await settle();

    await user.press(screen.getAllByRole("checkbox")[0]);
    await user.press(
      screen.getByRole("button", { name: t("athkar.library.addSelected", { count: 1 }) })
    );

    expect(MessageToast.showError).toHaveBeenCalledWith(t("athkar.library.addFailed"));
    expect(screen.getAllByRole("checkbox")[0]).toBeChecked();
  });

  it("shows a dhikr already in My Athkar as added, not choosable", async () => {
    useMyAthkarStore.setState({
      items: [
        {
          id: 50,
          sourceAthkarId: BISMIKA.id,
          sourceCategoryId: SLEEP.id,
          userCount: 1,
          sortOrder: 0,
        },
      ],
    });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await open();
    await user.type(field(), "sleep");
    await settle();

    const added = screen.getByRole("checkbox", { name: new RegExp(BISMIKA.translation) });
    expect(added).toBeChecked();
    expect(added).toBeDisabled();
    await user.press(added);
    expect(
      screen.queryByRole("button", { name: t("athkar.library.addSelected", { count: 1 }) })
    ).toBeNull();
  });

  it("says a search failed, not that nothing matched, and retries it", async () => {
    jest.mocked(HisnMuslimDB.search).mockRejectedValueOnce(READ_FAILED);
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await open();

    await user.type(field(), 'glory"');
    await settle();

    expect(failedPanel()).toBeOnTheScreen();
    expect(screen.queryByText(t("athkar.myAthkar.noResults"))).toBeNull();
    await user.press(retry());
    await settle();
    expect(failedPanel()).toBeNull();
    expect(screen.getByText(TASBIH.translation)).toBeOnTheScreen();
  });

  it("drops the last results when the next search fails", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await open();
    await user.type(field(), "glory");
    await settle();
    jest.mocked(HisnMuslimDB.search).mockRejectedValueOnce(READ_FAILED);

    await user.type(field(), "x");
    await settle();

    expect(screen.queryByText(TASBIH.translation)).toBeNull();
    expect(failedPanel()).toBeOnTheScreen();
  });

  it("says the topics failed to load and retries them", async () => {
    jest.mocked(HisnMuslimDB.getCategories).mockRejectedValueOnce(READ_FAILED);
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await open();

    await waitFor(() => expect(failedPanel()).toBeOnTheScreen());
    await user.press(retry());

    expect(await screen.findByRole("button", { name: SLEEP.titleEn })).toBeOnTheScreen();
    expect(failedPanel()).toBeNull();
  });

  it("says a topic failed to open and retries it under its title", async () => {
    jest.mocked(HisnMuslimDB.getCategoryAthkar).mockRejectedValueOnce(READ_FAILED);
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await open();

    await user.press(await screen.findByRole("button", { name: SLEEP.titleEn }));

    expect(failedPanel()).toBeOnTheScreen();
    expect(screen.getByText(SLEEP.titleEn)).toBeOnTheScreen();
    await user.press(retry());
    expect(await screen.findByRole("checkbox", { name: new RegExp(BISMIKA.translation) }));
  });

  it("shows only the athkar of the topic opened last", async () => {
    const sleep = later<HisnAthkar[]>();
    const travel = later<HisnAthkar[]>();
    jest
      .mocked(HisnMuslimDB.getCategoryAthkar)
      .mockImplementation((id) => (id === SLEEP.id ? sleep.promise : travel.promise));
    const travelDua = { ...dhikr(3, "الله أكبر", "Allah is the greatest"), categoryId: TRAVEL.id };
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await open();

    await user.press(await screen.findByRole("button", { name: SLEEP.titleEn }));
    await user.press(screen.getByRole("button", { name: t("athkar.library.allTopics") }));
    await user.press(screen.getByRole("button", { name: TRAVEL.titleEn }));
    await act(async () => travel.release([travelDua]));
    await act(async () => sleep.release([BISMIKA]));

    expect(screen.getByText(TRAVEL.titleEn)).toBeOnTheScreen();
    expect(screen.getByText(travelDua.translation)).toBeOnTheScreen();
    expect(screen.queryByText(BISMIKA.translation)).toBeNull();
  });

  it("frees the add button and says so when adding throws", async () => {
    batchAddItems.mockRejectedValueOnce(READ_FAILED);
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await open();
    await user.type(field(), "sleep");
    await settle();

    await user.press(screen.getAllByRole("checkbox")[0]);
    const add = () =>
      screen.getByRole("button", { name: t("athkar.library.addSelected", { count: 1 }) });
    await user.press(add());

    expect(MessageToast.showError).toHaveBeenCalledWith(t("athkar.library.addFailed"));
    expect(add()).toBeEnabled();
  });

  it("moves reader focus to an opened topic's title, and back to its row", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await open();

    await user.press(await screen.findByRole("button", { name: SLEEP.titleEn }));
    await layOut(screen.getByRole("header", { name: SLEEP.titleEn }));
    expect(lastFocused()).toBe(SLEEP.titleEn);

    await user.press(screen.getByRole("button", { name: t("athkar.library.allTopics") }));
    await layOut(screen.getByRole("button", { name: SLEEP.titleEn }));
    expect(lastFocused()).toEqual(expect.stringContaining(SLEEP.titleEn));
  });

  it("says how many athkar a search found, or that none matched", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await open();

    await user.type(field(), "glory");
    await settle();
    expect(announce).toHaveBeenLastCalledWith(t("a11y.athkar.searchResults", { count: 2 }));

    jest.mocked(HisnMuslimDB.search).mockResolvedValueOnce([]);
    await user.type(field(), "zzz");
    await settle();
    expect(announce).toHaveBeenLastCalledWith(t("athkar.myAthkar.noResults"));
  });

  it("says the count again when a new search finds as many", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await open();

    await user.type(field(), "glory");
    await settle();
    announce.mockClear();

    await user.type(field(), " be");
    await settle();
    expect(announce).toHaveBeenCalledWith(t("a11y.athkar.searchResults", { count: 2 }));
  });

  it("hints that a topic row opens the topic", async () => {
    await open();

    expect(await screen.findByRole("button", { name: SLEEP.titleEn })).toHaveProp(
      "accessibilityHint",
      t("a11y.opens", { name: SLEEP.titleEn })
    );
  });

  it("names every control and gives it a full target", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await open();
    await screen.findByRole("button", { name: SLEEP.titleEn });
    await user.type(field(), "sleep");
    await settle();
    await user.press(screen.getAllByRole("checkbox")[1]);

    // The scrim fills the screen; under jest it has no frame to measure.
    const scrim = `${t("a11y.dismiss")}: under 44pt`;
    expect(controlProblems().filter((problem) => problem !== scrim)).toEqual([]);
  });
});
