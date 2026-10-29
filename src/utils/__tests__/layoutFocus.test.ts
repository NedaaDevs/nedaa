import { AccessibilityInfo, type ViewInstance } from "react-native";

import { layoutFocus } from "@/utils/layoutFocus";

describe("layoutFocus", () => {
  let send: jest.SpyInstance;
  const first = {} as ViewInstance;
  const second = {} as ViewInstance;
  beforeEach(() => {
    send = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent").mockImplementation(() => {});
    // The preset's mock is shared, so calls from earlier suites stay on it.
    send.mockClear();
  });
  afterEach(() => jest.restoreAllMocks());

  // A view mounted in this commit may have no native view for the event yet.
  it("focuses a view at its first layout after the request, not before", () => {
    const target = layoutFocus();
    target.ref.current = first;

    target.focus();
    expect(send).not.toHaveBeenCalled();
    target.onLayout();
    target.onLayout();

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(first, "focus");
  });

  it("focuses a view already laid out at once", () => {
    const target = layoutFocus();
    target.ref.current = first;
    target.onLayout();
    expect(send).not.toHaveBeenCalled();

    target.focus();

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(first, "focus");
  });

  it("waits for a new view's own layout", () => {
    const target = layoutFocus();
    target.ref.current = first;
    target.onLayout();
    target.ref.current = second;

    target.focus();
    expect(send).not.toHaveBeenCalled();
    target.onLayout();

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(second, "focus");
  });
});
