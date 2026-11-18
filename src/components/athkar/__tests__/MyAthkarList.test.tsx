import { AccessibilityInfo } from "react-native";
import { act, screen, userEvent } from "@testing-library/react-native";

import MyAthkarList from "@/components/athkar/MyAthkarList";
import { CUSTOM_ATHKAR_HREF } from "@/constants/Athkar";
import { SESSION_SOURCE } from "@/constants/AthkarSession";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { useCustomAthkarStore } from "@/stores/custom-athkar";
import { useMyAthkarStore } from "@/stores/my-athkar";
import { useBottomSheetModal } from "@/test-helpers/bottomSheetMock";
import { controlProblems } from "@/test-helpers/controls";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("react-native-safe-area-context", () =>
  jest.requireActual("@/test-helpers/safeAreaMock")
);
jest.mock("@/hooks/useHaptic", () => jest.requireActual("@/test-helpers/hapticMock"));
const LOADED = {
  isMyAthkarInit: true,
  isCustomInit: true,
  myAthkarFailed: false,
  customFailed: false,
};
let mockStores = LOADED;
const mockRetry = jest.fn(async () => {});
jest.mock("@/hooks/useInitializeAthkarStores", () => ({
  useInitializeAthkarStores: () => ({ ...mockStores, retry: mockRetry }),
}));
jest.mock("@/services/hisn-muslim-db", () => ({
  HisnMuslimDB: {
    getCategories: async () => [],
    search: async () => [],
    getCategoryAthkar: async () => [],
  },
}));
const mockPush = jest.fn();
const mockOpen = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

const t = i18n.t.bind(i18n);
const failedPanel = () => screen.queryByText(t("athkar.library.loadFailed.title"));
const searchRow = () =>
  screen.getByRole("button", { name: new RegExp(t("athkar.library.searchHisn")) });
const focusEvent = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent");

const SLEEP = { id: 7, titleAr: "أذكار النوم", titleEn: "Before sleep" };

const seedHisn = () => {
  const entry = (id: number) => ({
    id,
    categoryId: SLEEP.id,
    arabicText: "نص",
    transliteration: "",
    translation: "",
    repeatCount: 1,
    audioUrl: null,
    sortOrder: id,
    categoryTitleAr: SLEEP.titleAr,
    categoryTitleEn: SLEEP.titleEn,
  });
  useMyAthkarStore.setState({
    items: [1, 2].map((id) => ({
      id: id + 10,
      sourceAthkarId: id,
      sourceCategoryId: SLEEP.id,
      userCount: 1,
      sortOrder: id,
    })),
    displayData: new Map([1, 2].map((id) => [id, entry(id)])),
    progress: [
      { myAthkarId: 11, currentCount: 1, totalCount: 1, completed: true },
      { myAthkarId: 12, currentCount: 0, totalCount: 1, completed: false },
    ],
  });
};

const seedCustom = () =>
  useCustomAthkarStore.setState({
    groups: [{ id: 3, title: "After prayer", sortOrder: 0 }],
    items: [{ id: 30, groupId: 3, arabicText: "أستغفر الله", userCount: 3, sortOrder: 0 }],
    progress: [{ customItemId: 30, currentCount: 0, totalCount: 3, completed: false }],
  });

beforeEach(() => {
  mockStores = LOADED;
  mockRetry.mockClear();
  focusEvent.mockClear();
  mockPush.mockClear();
  mockOpen.mockClear();
  useMyAthkarStore.setState({ items: [], displayData: new Map(), progress: [] });
  useCustomAthkarStore.setState({ groups: [], items: [], progress: [] });
});
afterEach(async () => {
  useAppStore.setState({ locale: AppLocale.EN });
  await act(() => i18n.changeLanguage(AppLocale.EN));
});

describe("MyAthkarList", () => {
  it("says where saved athkar appear while there are none", async () => {
    await renderWithTheme(<MyAthkarList onOpen={mockOpen} />);

    expect(screen.getByText(t("athkar.library.empty"))).toBeOnTheScreen();
    expect(screen.queryByText(t("athkar.library.groups", { count: 0 }))).toBeNull();
  });

  it("lists each saved group with what is done today", async () => {
    seedHisn();
    seedCustom();
    await renderWithTheme(<MyAthkarList onOpen={mockOpen} />);

    expect(screen.getByText(t("athkar.library.groups", { count: 2 }))).toBeOnTheScreen();
    expect(
      screen.getByRole("button", {
        name: new RegExp(
          `${SLEEP.titleEn}.*${t("a11y.customAthkar.cardProgress", { current: 1, total: 2 })}`
        ),
      })
    ).toBeOnTheScreen();
    expect(
      screen.getByRole("button", {
        name: new RegExp(`After prayer.*${t("athkar.library.custom")}`),
      })
    ).toBeOnTheScreen();
  });

  it("names the group count in Arabic with its own plural form", async () => {
    useAppStore.setState({ locale: AppLocale.AR });
    await act(() => i18n.changeLanguage(AppLocale.AR));
    seedHisn();
    seedCustom();
    await renderWithTheme(<MyAthkarList onOpen={mockOpen} />, { isRTL: true });

    expect(screen.getByText("مجموعتان")).toBeOnTheScreen();
  });

  it("opens Hisn al-Muslim search from its row", async () => {
    const user = userEvent.setup();
    await renderWithTheme(<MyAthkarList onOpen={mockOpen} />);

    await user.press(
      screen.getByRole("button", { name: new RegExp(t("athkar.library.searchHisn")) })
    );

    expect(screen.getByPlaceholderText(t("athkar.myAthkar.search"))).toBeOnTheScreen();
  });

  it("starts a custom group in the editor", async () => {
    const user = userEvent.setup();
    await renderWithTheme(<MyAthkarList onOpen={mockOpen} />);

    await user.press(screen.getByRole("button", { name: t("athkar.library.createGroup") }));

    expect(mockPush).toHaveBeenCalledWith(CUSTOM_ATHKAR_HREF.NEW);
  });

  it.each([
    { name: SLEEP.titleEn, source: { kind: SESSION_SOURCE.HISN, categoryId: SLEEP.id } },
    { name: "After prayer", source: { kind: SESSION_SOURCE.CUSTOM, groupId: 3 } },
  ])("opens $name as a session", async ({ name, source }) => {
    const user = userEvent.setup();
    seedHisn();
    seedCustom();
    await renderWithTheme(<MyAthkarList onOpen={mockOpen} />);

    await user.press(screen.getByRole("button", { name: new RegExp(name) }));

    expect(mockOpen).toHaveBeenCalledWith(source);
  });

  it("keeps the custom groups and offers a retry when My Athkar fails to load", async () => {
    mockStores = { ...LOADED, isMyAthkarInit: false, myAthkarFailed: true };
    seedCustom();
    const user = userEvent.setup();
    await renderWithTheme(<MyAthkarList onOpen={mockOpen} />);

    expect(screen.getByRole("button", { name: /After prayer/ })).toBeOnTheScreen();
    expect(failedPanel()).toBeOnTheScreen();
    await user.press(screen.getByRole("button", { name: t("common.retry") }));
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it("says the load failed, not that nothing is saved", async () => {
    mockStores = { ...LOADED, isCustomInit: false, customFailed: true };
    await renderWithTheme(<MyAthkarList onOpen={mockOpen} />);

    expect(failedPanel()).toBeOnTheScreen();
    expect(screen.queryByText(t("athkar.library.empty"))).toBeNull();
    expect(screen.queryByText(t("athkar.loading.initializing"))).toBeNull();
  });

  it("waits while a collection is still loading", async () => {
    mockStores = { ...LOADED, isCustomInit: false };
    await renderWithTheme(<MyAthkarList onOpen={mockOpen} />);

    expect(screen.getByText(t("athkar.loading.initializing"))).toBeOnTheScreen();
    expect(failedPanel()).toBeNull();
  });

  it("returns reader focus to the search row once the sheet closes", async () => {
    const user = userEvent.setup();
    await renderWithTheme(<MyAthkarList onOpen={mockOpen} />);
    await user.press(searchRow());
    focusEvent.mockClear();

    await act(() => useBottomSheetModal().dismiss());

    const [node] = focusEvent.mock.lastCall ?? [];
    const label = (node as { props?: { accessibilityLabel?: string } })?.props?.accessibilityLabel;
    expect(label).toBe(searchRow().props.accessibilityLabel);
  });

  it("hints that each row opens what it names", async () => {
    seedHisn();
    seedCustom();
    await renderWithTheme(<MyAthkarList onOpen={mockOpen} />);

    for (const name of [t("athkar.library.searchHisn"), SLEEP.titleEn, "After prayer"]) {
      const row = screen.getByRole("button", { name: new RegExp(name) });
      expect(row).toHaveProp("accessibilityHint", t("a11y.opens", { name }));
    }
  });

  it("names every control and gives it a full target", async () => {
    seedHisn();
    seedCustom();
    await renderWithTheme(<MyAthkarList onOpen={mockOpen} />);

    expect(controlProblems()).toEqual([]);
  });
});
