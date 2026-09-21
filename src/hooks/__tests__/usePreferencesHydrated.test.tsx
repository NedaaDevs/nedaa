import React from "react";
import renderer, { act } from "react-test-renderer";
import { Text as RNText } from "react-native";

import { usePreferencesHydrated } from "@/hooks/usePreferencesHydrated";

jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
  },
}));

const Probe = () => <RNText>{usePreferencesHydrated() ? "yes" : "no"}</RNText>;

test("reports true once the preferences store finishes hydration", async () => {
  let tree: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<Probe />);
  });
  // act flushed the async kv-store hydration.
  expect(tree!.root.findByType(RNText).props.children).toBe("yes");
});
