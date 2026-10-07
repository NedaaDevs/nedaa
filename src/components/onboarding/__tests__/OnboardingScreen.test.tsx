import React from "react";
import renderer, { act } from "react-test-renderer";

import OnboardingScreen from "@/components/onboarding/OnboardingScreen";

// Hoisted jest.mock factories may only close over `mock`-prefixed names.
// Each step stub records the onNext it was handed.
const mockStepState = {
  rendered: [] as string[],
  onNext: undefined as (() => void) | undefined,
};
const mockSetIsFirstRun = jest.fn();

const mockStep = (id: string) => {
  const Step = ({ onNext }: { onNext: () => void }) => {
    mockStepState.rendered.push(id);
    mockStepState.onNext = onNext;
    return null;
  };
  return { id, component: Step };
};

jest.mock("@/components/onboarding/useOnboardingSteps", () => ({
  useOnboardingSteps: () => ({
    steps: [mockStep("first"), mockStep("middle"), mockStep("last")],
    loading: false,
  }),
}));

jest.mock("@/stores/app", () => ({
  useAppStore: () => ({ setIsFirstRun: mockSetIsFirstRun }),
}));

jest.mock("@/components/onboarding/OnboardingDots", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/ui/box", () => ({
  Box: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

const lastRendered = () => mockStepState.rendered[mockStepState.rendered.length - 1];

const render = async () => {
  await act(async () => {
    renderer.create(<OnboardingScreen />);
  });
};

/** Calls one render's onNext `times` times before React re-renders. */
const nextFromSameRender = async (times: number) => {
  const onNext = mockStepState.onNext;
  await act(async () => {
    for (let i = 0; i < times; i++) onNext?.();
  });
};

describe("onboarding screen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStepState.rendered = [];
    mockStepState.onNext = undefined;
  });

  test("advances one step per onNext", async () => {
    await render();

    await nextFromSameRender(1);

    expect(lastRendered()).toBe("middle");
  });

  test("a repeated onNext from one step advances only once", async () => {
    await render();
    await nextFromSameRender(1);

    // A permission prompt that resolves twice calls the same onNext twice.
    await nextFromSameRender(2);

    expect(lastRendered()).toBe("last");
    expect(mockSetIsFirstRun).not.toHaveBeenCalled();
  });

  test("finishes first run from the last step", async () => {
    await render();
    await nextFromSameRender(1);
    await nextFromSameRender(1);

    await nextFromSameRender(1);

    expect(mockSetIsFirstRun).toHaveBeenCalledWith(false);
  });
});
