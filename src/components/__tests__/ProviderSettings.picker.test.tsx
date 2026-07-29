import React from "react";
import renderer, { act } from "react-test-renderer";

import { ProviderSettings } from "@/components/ProviderSettings";

let mockProviders: { id: string }[] = [];
const mockGetProviders = jest.fn(() => Promise.resolve());

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("@/components/ui/box", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View: RNView } = require("react-native");
  return { Box: RNView };
});

jest.mock("@/components/ui/text", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text: RNText } = require("react-native");
  return { Text: RNText };
});

jest.mock("@/components/ui/spinner", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View: RNView } = require("react-native");
  return { Spinner: RNView };
});

jest.mock("@/components/ui/pressable", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View: RNView } = require("react-native");
  return { Pressable: RNView };
});

jest.mock("@/components/ProviderList", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View: RNView } = require("react-native");
  return { ProviderList: () => <RNView testID="provider-list" /> };
});

jest.mock("@/components/AladhanSettings", () => () => null);

jest.mock("@/stores/prayerTimes", () => ({
  usePrayerTimesStore: () => ({
    isGettingProviders: false,
    providers: mockProviders,
    getProviders: mockGetProviders,
  }),
}));

jest.mock("@/stores/providerSettings", () => ({
  useProviderSettingsStore: () => ({ currentProviderId: "aladhan" }),
}));

jest.mock("@/utils/appLogger", () => ({
  AppLogger: { create: () => ({ d: jest.fn(), i: jest.fn(), w: jest.fn(), e: jest.fn() }) },
}));

const render = async () => {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<ProviderSettings />);
  });
  return tree;
};

describe("ProviderSettings provider picker", () => {
  test("hides the picker while only one provider exists", async () => {
    mockProviders = [{ id: "aladhan" }];

    const tree = await render();

    expect(tree.root.findAllByProps({ testID: "provider-list" })).toHaveLength(0);
  });

  test("shows the picker once a second provider exists", async () => {
    mockProviders = [{ id: "aladhan" }, { id: "second" }];

    const tree = await render();

    expect(tree.root.findAllByProps({ testID: "provider-list" }).length).toBeGreaterThan(0);
  });
});
