import { AppLogger } from "@/utils/appLogger";
import { logWidgetAttachContext } from "@/services/widgetDiagnostics";

import type { WidgetAttachContextDeps } from "@/services/widgetDiagnostics";

// The module builds its logger at import time, so the stub has to exist inside the
// factory rather than in a `const` the hoisted mock would still see uninitialised.
jest.mock("@/utils/appLogger", () => {
  const domainLog = { i: jest.fn(), w: jest.fn(), e: jest.fn() };
  return { AppLogger: { create: () => domainLog } };
});

const mockLog = AppLogger.create("widgets") as unknown as {
  i: jest.Mock;
  w: jest.Mock;
  e: jest.Mock;
};

jest.mock("../../../modules/expo-widgets/src", () => ({
  getPlacedWidgetCount: jest.fn(() => 0),
  isPersistentNotificationEnabled: jest.fn(() => false),
}));

const makeDeps = (overrides: Partial<WidgetAttachContextDeps> = {}): WidgetAttachContextDeps => ({
  getPlacedWidgetCount: jest.fn(() => 2),
  isPersistentNotificationEnabled: jest.fn(() => true),
  ...overrides,
});

beforeEach(() => {
  mockLog.i.mockClear();
  mockLog.w.mockClear();
});

describe("logWidgetAttachContext", () => {
  test("records both attach candidates on one line", () => {
    logWidgetAttachContext(makeDeps());

    expect(mockLog.i).toHaveBeenCalledWith(
      "AttachContext",
      "placedWidgets=2 persistentNotification=on"
    );
  });

  test("records an empty home screen rather than staying silent", () => {
    logWidgetAttachContext(
      makeDeps({
        getPlacedWidgetCount: jest.fn(() => 0),
        isPersistentNotificationEnabled: jest.fn(() => false),
      })
    );

    // A crash report must be able to tell "none placed" from "never logged".
    expect(mockLog.i).toHaveBeenCalledWith(
      "AttachContext",
      "placedWidgets=0 persistentNotification=off"
    );
  });

  test("warns instead of reporting zero when the native read throws", () => {
    logWidgetAttachContext(
      makeDeps({
        getPlacedWidgetCount: jest.fn(() => {
          throw new Error("React context not available");
        }),
      })
    );

    expect(mockLog.i).not.toHaveBeenCalled();
    expect(mockLog.w).toHaveBeenCalledWith(
      "AttachContext",
      expect.stringContaining("React context not available")
    );
  });

  test("reads the flag even when no widget is placed", () => {
    const deps = makeDeps({ getPlacedWidgetCount: jest.fn(() => 0) });

    logWidgetAttachContext(deps);

    // The shade card attaches without a placed widget, so the flag is not conditional.
    expect(deps.isPersistentNotificationEnabled).toHaveBeenCalledTimes(1);
  });
});
