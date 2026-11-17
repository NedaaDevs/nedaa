import { act, renderHook } from "@testing-library/react-native";

jest.mock("@/services/athkar-db", () => ({ AthkarDB: {} }));
jest.mock("@/stores/location", () => ({
  __esModule: true,
  default: { getState: () => ({ locationDetails: { timezone: "Asia/Riyadh" } }) },
}));
jest.mock(
  "expo-sqlite/kv-store",
  () => jest.requireActual("@/test-helpers/memoryKvStore").memoryKvStoreModule
);
jest.mock("@/utils/appLogger", () => ({
  AppLogger: { create: () => ({ i: jest.fn(), w: jest.fn(), e: jest.fn() }) },
}));
jest.mock("@/hooks/useHaptic", () => jest.requireActual("@/test-helpers/hapticMock"));
jest.mock("expo-blur", () => jest.requireActual("@/test-helpers/blurMock"));
jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("react-native-safe-area-context", () =>
  jest.requireActual("@/test-helpers/safeAreaMock")
);
jest.mock("@/components/athkar/looks/registry", () =>
  jest.requireActual("@/test-helpers/athkarLooks").registryWithTestLook()
);

/* eslint-disable import/first -- imports must follow jest.mock hoisting */
import { CLASSIC_LOOK } from "@/components/athkar/looks/classic/look";
import type { AthkarLookId } from "@/constants/AthkarLook";
import { DEFAULT_ATHKAR_LOOK } from "@/constants/AthkarLook";
import { useAthkarLook } from "@/hooks/useAthkarLook";
import { useAthkarStore } from "@/stores/athkar";
import { TEST_LOOK, TEST_LOOK_ID } from "@/test-helpers/athkarLooks";
/* eslint-enable import/first */

const store = (look: AthkarLookId | null) =>
  useAthkarStore.setState((state) => ({ settings: { ...state.settings, look } }));

describe("useAthkarLook", () => {
  beforeEach(() => store(null));

  it("draws Classic until a person chooses", async () => {
    const { result } = await renderHook(() => useAthkarLook());

    expect(result.current).toBe(CLASSIC_LOOK);
  });

  it("draws the stored look and follows a new choice", async () => {
    store(TEST_LOOK_ID);
    const { result } = await renderHook(() => useAthkarLook());
    expect(result.current).toBe(TEST_LOOK);

    await act(async () => store(DEFAULT_ATHKAR_LOOK));

    expect(result.current).toBe(CLASSIC_LOOK);
  });
});
