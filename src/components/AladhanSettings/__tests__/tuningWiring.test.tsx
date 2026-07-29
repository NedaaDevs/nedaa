import React from "react";
import renderer, { act } from "react-test-renderer";

import { TuningStepper } from "@/components/AladhanSettings/TuningStepper";
import { useAladhanSettings } from "@/hooks/useProviderSettings";
import { useProviderSettingsStore } from "@/stores/providerSettings";
import { clampTuning } from "@/components/AladhanSettings/tuning";
import { PRAYER_TIME_PROVIDERS } from "@/constants/providers";

jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock("@/components/ui/hstack", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View: RNView } = require("react-native");
  return { HStack: RNView };
});

jest.mock("@/components/ui/text", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text: RNText } = require("react-native");
  return { Text: RNText };
});

jest.mock("@/components/ui/pressable", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View: RNView } = require("react-native");
  return { Pressable: RNView };
});

jest.mock("@/contexts/RTLContext", () => ({
  useRTL: () => ({ isRTL: false, direction: "ltr" }),
}));

jest.mock("@/utils/number", () => ({ formatNumberToLocale: (s: string) => s }));

jest.mock("@/components/ui/icon", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View: RNView } = require("react-native");
  return { Icon: RNView };
});

/** Mirrors the real wiring in TuningSettings, against the real store. */
const Harness = () => {
  const { settings, updateSettings } = useAladhanSettings();
  const tuning = settings?.tune || PRAYER_TIME_PROVIDERS.ALADHAN.tuning;

  return (
    <TuningStepper
      label="Fajr"
      value={tuning.fajr ?? 0}
      onChange={(value) => updateSettings({ tune: { ...tuning, fajr: clampTuning(value) } })}
    />
  );
};

describe("tuning wiring against the real store", () => {
  beforeEach(() => {
    useProviderSettingsStore.setState({
      allSettings: { aladhan: { method: 3 } },
      currentProviderId: "aladhan",
    });
  });

  test("an increment reaches the store", async () => {
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<Harness />);
    });

    await act(async () => {
      tree.root.findByProps({ testID: "tuning-increment" }).props.onPress();
    });

    expect(useProviderSettingsStore.getState().getCurrentSettings<any>().tune.fajr).toBe(1);
  });

  test("the displayed offset follows the store", async () => {
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<Harness />);
    });

    await act(async () => {
      tree.root.findByProps({ testID: "tuning-increment" }).props.onPress();
    });

    expect(tree.root.findByProps({ testID: "tuning-stepper" }).props.accessibilityValue.now).toBe(
      1
    );
  });

  test("repeated increments accumulate", async () => {
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<Harness />);
    });

    for (let i = 0; i < 3; i++) {
      await act(async () => {
        tree.root.findByProps({ testID: "tuning-increment" }).props.onPress();
      });
    }

    expect(tree.root.findByProps({ testID: "tuning-stepper" }).props.accessibilityValue.now).toBe(
      3
    );
  });
});
