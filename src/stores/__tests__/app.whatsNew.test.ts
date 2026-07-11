import { useAppStore } from "@/stores/app";
import { ALL_WHATS_NEW_IDS } from "@/constants/WhatsNew";

jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

describe("app store what's-new seen-set", () => {
  beforeEach(() => {
    useAppStore.setState({ dismissedFeatureCards: [], isFirstRun: true });
  });

  test("dismissFeatureCards marks a batch as seen, deduped", () => {
    useAppStore.setState({ dismissedFeatureCards: ["important-days-v1"] });
    useAppStore.getState().dismissFeatureCards(["important-days-v1", "umrah-guide-v1"]);
    expect(useAppStore.getState().dismissedFeatureCards).toEqual([
      "important-days-v1",
      "umrah-guide-v1",
    ]);
  });

  test("completing first run seeds every current announcement id", () => {
    useAppStore.getState().setIsFirstRun(false);
    const seen = useAppStore.getState().dismissedFeatureCards;
    ALL_WHATS_NEW_IDS.forEach((id) => expect(seen).toContain(id));
  });
});
