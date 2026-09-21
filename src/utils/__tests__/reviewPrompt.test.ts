let mockVersion = "2.10.5";
const mockRequestReview = jest.fn(() => Promise.resolve());
const mockHasAction = jest.fn(() => Promise.resolve(true));

// In-memory stand-in for the kv-store, so each case starts from a known set of keys.
let mockStore: Record<string, string> = {};

jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItemAsync: jest.fn((key: string) => Promise.resolve(mockStore[key] ?? null)),
    setItemAsync: jest.fn((key: string, value: string) => {
      mockStore[key] = value;
      return Promise.resolve();
    }),
  },
}));

jest.mock("expo-application", () => ({
  get nativeApplicationVersion() {
    return mockVersion;
  },
}));

jest.mock("expo-store-review", () => ({
  hasAction: () => mockHasAction(),
  requestReview: () => mockRequestReview(),
}));

import { promptReviewIfEligible, trackAppSession } from "@/utils/reviewPrompt";

const SESSIONS_KEY = "review_app_sessions";
const SESSIONS_VERSION_KEY = "review_app_sessions_version";
const LAST_VERSION_KEY = "review_last_version_prompted";

const launch = async (times: number) => {
  for (let i = 0; i < times; i++) await trackAppSession();
};

beforeEach(() => {
  jest.useFakeTimers();
  mockStore = {};
  mockVersion = "2.10.5";
  mockRequestReview.mockClear();
  mockHasAction.mockClear();
  mockHasAction.mockImplementation(() => Promise.resolve(true));
});

afterEach(() => {
  jest.useRealTimers();
});

// promptReviewIfEligible reads several keys before it schedules its 2s wait, so
// the timer has to be advanced asynchronously to let those reads settle first.
const runPrompt = async () => {
  const pending = promptReviewIfEligible();
  await jest.advanceTimersByTimeAsync(2500);
  await pending;
};

describe("trackAppSession", () => {
  it("counts launches on one version", async () => {
    await launch(3);
    expect(mockStore[SESSIONS_KEY]).toBe("3");
    expect(mockStore[SESSIONS_VERSION_KEY]).toBe("2.10.5");
  });

  it("resets the count when the app version changes", async () => {
    await launch(9);
    mockVersion = "2.11.0";
    await launch(1);

    expect(mockStore[SESSIONS_KEY]).toBe("1");
    expect(mockStore[SESSIONS_VERSION_KEY]).toBe("2.11.0");
  });
});

describe("promptReviewIfEligible", () => {
  it("requests a review once the session bar is met", async () => {
    await launch(5);
    await runPrompt();

    expect(mockRequestReview).toHaveBeenCalledTimes(1);
    expect(mockStore[LAST_VERSION_KEY]).toBe("2.10.5");
  });

  it("stays quiet below the session bar", async () => {
    await launch(4);
    await runPrompt();

    expect(mockRequestReview).not.toHaveBeenCalled();
  });

  it("asks at most once per version", async () => {
    await launch(5);
    await runPrompt();
    await runPrompt();

    expect(mockRequestReview).toHaveBeenCalledTimes(1);
  });

  it("makes an upgraded user earn the bar again on the new version", async () => {
    await launch(20);
    mockVersion = "2.11.0";
    await launch(2);
    await runPrompt();

    expect(mockRequestReview).not.toHaveBeenCalled();
  });

  it("never asks on a suppressed release", async () => {
    mockVersion = "3.0.0";
    await launch(50);
    await runPrompt();

    expect(mockRequestReview).not.toHaveBeenCalled();
  });

  it("does not hand a suppressed release's prompt to the next release", async () => {
    mockVersion = "3.0.0";
    await launch(50);
    await runPrompt();

    mockVersion = "3.0.1";
    await launch(50);
    await runPrompt();

    expect(mockRequestReview).not.toHaveBeenCalled();
    expect(mockStore[LAST_VERSION_KEY]).toBe("3.0.1");
  });

  it("claims the version even when the request rejects", async () => {
    mockRequestReview.mockImplementation(() => Promise.reject(new Error("no dialog")));
    await launch(5);
    await runPrompt();

    expect(mockStore[LAST_VERSION_KEY]).toBe("2.10.5");

    mockRequestReview.mockImplementation(() => Promise.resolve());
    await runPrompt();
    expect(mockRequestReview).toHaveBeenCalledTimes(1);
  });

  it("leaves the version unclaimed when the store has no review action", async () => {
    mockHasAction.mockImplementation(() => Promise.resolve(false));
    await launch(5);
    await runPrompt();

    expect(mockRequestReview).not.toHaveBeenCalled();
    expect(mockStore[LAST_VERSION_KEY]).toBeUndefined();
  });
});
