import { triggerWidgetReload } from "@/services/widgetBridge";
import { writeWidgetSnapshot } from "@/services/widgetSnapshot";
import { refreshAllWidgets } from "../../../modules/expo-widgets/src";

jest.mock("@/services/widgetSnapshot", () => ({ writeWidgetSnapshot: jest.fn(async () => {}) }));
jest.mock("../../../modules/expo-widget/src", () => ({ reloadAllWidgets: jest.fn() }));
jest.mock("../../../modules/expo-widgets/src", () => ({
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
