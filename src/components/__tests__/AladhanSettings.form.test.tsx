import React from "react";
import renderer, { act } from "react-test-renderer";

import AladhanSettings from "@/components/AladhanSettings";

let mockIsLoading = false;
const mockUpdateSettings = jest.fn();

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("@/hooks/useHaptic", () => ({ useHaptic: () => jest.fn() }));

jest.mock("@/components/ui/box", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View: RNView } = require("react-native");
  return { Box: RNView };
});

jest.mock("@/components/ui/card", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View: RNView } = require("react-native");
  return { Card: RNView };
});

jest.mock("@/components/ui/spinner", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View: RNView } = require("react-native");
  return { Spinner: () => <RNView testID="spinner" /> };
});

jest.mock("@/components/ui/text", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text: RNText } = require("react-native");
  return { Text: RNText };
});

jest.mock("@/components/ui/select", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View: RNView } = require("react-native");
  return {
    Select: ({ onValueChange, selectedValue }: any) => (
      <RNView testID="select" onValueChange={onValueChange} selectedValue={selectedValue} />
    ),
  };
});

jest.mock("@/components/AladhanSettings/TuningSettings", () => ({ TuningSettings: () => null }));
jest.mock("@/stores/providerSettings", () => ({
  useProviderSettingsStore: () => ({
    isLoading: mockIsLoading,
  }),
}));

jest.mock("@/hooks/useProviderSettings", () => ({
  useAladhanSettings: () => ({
    settings: { method: 3, madhab: 1, midnightMode: 0 },
    updateSettings: (...args: unknown[]) => mockUpdateSettings(...args),
  }),
}));

const render = async () => {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<AladhanSettings />);
  });
  return tree;
};

// RN's View yields a composite and a host node carrying the same testID; count hosts.
const hosts = (tree: renderer.ReactTestRenderer, testID: string) =>
  tree.root.findAllByProps({ testID }).filter((node) => typeof node.type === "string");

describe("AladhanSettings form", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsLoading = false;
  });

  test("shows a single skeleton while loading, not one per section", async () => {
    mockIsLoading = true;

    const tree = await render();

    expect(hosts(tree, "settings-form-skeleton")).toHaveLength(1);
    expect(hosts(tree, "spinner")).toHaveLength(1);
  });

  test("renders no selects while loading", async () => {
    mockIsLoading = true;

    const tree = await render();

    expect(hosts(tree, "select")).toHaveLength(0);
  });

  test("renders one select per section once loaded", async () => {
    const tree = await render();

    expect(hosts(tree, "select")).toHaveLength(3);
  });

  test("applies a chosen option to the settings", async () => {
    const tree = await render();

    await act(async () => {
      tree.root.findAllByProps({ testID: "select" })[0].props.onValueChange("5");
    });

    expect(mockUpdateSettings).toHaveBeenCalledWith({ method: 5 });
  });

  test("ignores an option that is not on offer", async () => {
    const tree = await render();

    await act(async () => {
      tree.root.findAllByProps({ testID: "select" })[0].props.onValueChange("999");
    });

    expect(mockUpdateSettings).not.toHaveBeenCalled();
  });
});
