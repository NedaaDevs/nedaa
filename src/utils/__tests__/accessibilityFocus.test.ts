import { AccessibilityInfo, type HostInstance } from "react-native";

import { focusOn } from "@/utils/accessibilityFocus";

it("sends focus to a node and ignores a missing one", () => {
  const send = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent").mockImplementation(() => {});
  const node = {} as HostInstance;

  focusOn(node);
  focusOn(null);
  focusOn(undefined);

  expect(send).toHaveBeenCalledTimes(1);
  expect(send).toHaveBeenCalledWith(node, "focus");
  send.mockRestore();
});
