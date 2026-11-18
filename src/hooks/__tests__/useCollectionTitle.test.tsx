import { act, renderHook } from "@testing-library/react-native";

import { SESSION_SOURCE, type CollectionSource } from "@/constants/AthkarSession";
import { AppLocale } from "@/enums/app";
import { useCollectionTitle } from "@/hooks/useCollectionTitle";
import i18n from "@/localization/i18n";
import { useCustomAthkarStore } from "@/stores/custom-athkar";
import { useMyAthkarStore } from "@/stores/my-athkar";

jest.mock("@/services/hisn-muslim-db", () => ({ HisnMuslimDB: {} }));
jest.mock("@/services/athkar-db", () => ({ AthkarDB: {} }));

const SLEEP = { id: 7, titleAr: "أذكار النوم", titleEn: "Before sleep" };
const HISN: CollectionSource = { kind: SESSION_SOURCE.HISN, categoryId: SLEEP.id };
const CUSTOM: CollectionSource = { kind: SESSION_SOURCE.CUSTOM, groupId: 3 };

beforeEach(() => {
  useMyAthkarStore.setState({
    items: [{ id: 11, sourceAthkarId: 1, sourceCategoryId: SLEEP.id, userCount: 1, sortOrder: 0 }],
    displayData: new Map([
      [
        1,
        {
          id: 1,
          categoryId: SLEEP.id,
          arabicText: "نص",
          transliteration: "",
          translation: "",
          repeatCount: 1,
          audioUrl: null,
          sortOrder: 0,
          categoryTitleAr: SLEEP.titleAr,
          categoryTitleEn: SLEEP.titleEn,
        },
      ],
    ]),
  });
  useCustomAthkarStore.setState({ groups: [{ id: 3, title: "After prayer", sortOrder: 0 }] });
});
afterEach(() => act(() => i18n.changeLanguage(AppLocale.EN)));

describe("a collection's name", () => {
  test("no collection has no name", async () => {
    const { result } = await renderHook(() => useCollectionTitle(null));
    expect(result.current).toBeNull();
  });

  test("a saved topic is named in the app's language", async () => {
    const { result } = await renderHook(() => useCollectionTitle(HISN));
    expect(result.current).toBe(SLEEP.titleEn);

    await act(() => i18n.changeLanguage(AppLocale.AR));
    expect(result.current).toBe(SLEEP.titleAr);
  });

  test("a topic whose last dhikr left has no name", async () => {
    const { result } = await renderHook(() => useCollectionTitle(HISN));
    await act(() => useMyAthkarStore.setState({ items: [] }));
    expect(result.current).toBeNull();
  });

  test("a renamed group shows its new name", async () => {
    const { result } = await renderHook(() => useCollectionTitle(CUSTOM));
    await act(() =>
      useCustomAthkarStore.setState({ groups: [{ id: 3, title: "Evening walk", sortOrder: 0 }] })
    );
    expect(result.current).toBe("Evening walk");
  });

  test("a deleted group has no name", async () => {
    const { result } = await renderHook(() => useCollectionTitle(CUSTOM));
    await act(() => useCustomAthkarStore.setState({ groups: [] }));
    expect(result.current).toBeNull();
  });
});
