import { act, screen, userEvent } from "@testing-library/react-native";

import MyAthkarList from "@/components/athkar/MyAthkarList";
import { CUSTOM_ATHKAR_HREF } from "@/constants/Athkar";
import { SESSION_SOURCE } from "@/constants/AthkarSession";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { useCustomAthkarStore } from "@/stores/custom-athkar";
import { useMyAthkarStore } from "@/stores/my-athkar";
import { controlProblems } from "@/test-helpers/controls";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("react-native-safe-area-context", () =>
  jest.requireActual("@/test-helpers/safeAreaMock")
);
jest.mock("@/hooks/useHaptic", () => jest.requireActual("@/test-helpers/hapticMock"));
jest.mock("@/hooks/useInitializeAthkarStores", () => ({
  useInitializeAthkarStores: () => ({ isMyAthkarInit: true, isCustomInit: true }),
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

  it("names every control and gives it a full target", async () => {
    seedHisn();
    seedCustom();
    await renderWithTheme(<MyAthkarList onOpen={mockOpen} />);

    expect(controlProblems()).toEqual([]);
  });
});
