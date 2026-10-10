import { triggerWidgetReload } from "@/services/widgetBridge";
import { writeWidgetSnapshot } from "@/services/widgetSnapshot";
import { refreshAllWidgets } from "expo-widgets";

jest.mock("@/services/widgetSnapshot", () => ({ writeWidgetSnapshot: jest.fn(async () => {}) }));
jest.mock("expo-widget", () => ({ reloadAllWidgets: jest.fn() }));
jest.mock("expo-widgets", () => ({
  refreshAllWidgets: jest.fn(async () => {}),
}));

it("manual refresh waits for fresh data before notifying the Android widgets", async () => {
  let finishWrite!: () => void;
  (writeWidgetSnapshot as jest.Mock).mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finishWrite = resolve;
      })
  );
  const reload = triggerWidgetReload();
  expect(refreshAllWidgets).not.toHaveBeenCalled();
  finishWrite();
  await reload;
  expect(refreshAllWidgets).toHaveBeenCalledTimes(1);
});
