import React from "react";
import renderer, { act } from "react-test-renderer";

import { ProviderSaveBar } from "@/components/ProviderSaveBar";

const mockLoadPrayerTimes = jest.fn(() => Promise.resolve());
const mockSaveSettings = jest.fn(() => Promise.resolve());
const mockMarkSettingsApplied = jest.fn();
const mockScheduleNotifications = jest.fn(() => Promise.resolve());
const mockRescheduleAlarms = jest.fn(() => Promise.resolve());
const mockReloadPrayerWidgets = jest.fn();
const mockShowError = jest.fn();

let mockIsModified = true;

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("@/hooks/useHaptic", () => ({ useHaptic: () => jest.fn() }));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
}));

jest.mock("@/components/ui/box", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View: RNView } = require("react-native");
  return { Box: RNView };
});

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

jest.mock("@/components/ui/button", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View: RNView } = require("react-native");
  const MockButton = ({ children, onPress, disabled }: any) => (
    <RNView testID="save-button" onPress={onPress} disabled={disabled}>
      {children}
    </RNView>
  );
  const MockButtonText = ({ children }: any) => <RNView>{children}</RNView>;
  MockButtonText.displayName = "MockButtonText";
  const MockButtonSpinner = () => <RNView />;
  MockButtonSpinner.displayName = "MockButtonSpinner";
  MockButton.Text = MockButtonText;
  MockButton.Spinner = MockButtonSpinner;
  return { Button: MockButton };
});

jest.mock("@/components/feedback", () => ({
  MessageToast: { showError: (...args: unknown[]) => mockShowError(...args) },
}));

jest.mock("@/stores/prayerTimes", () => ({
  usePrayerTimesStore: () => ({
    isLoading: false,
    loadPrayerTimes: (...args: unknown[]) => mockLoadPrayerTimes(...(args as [])),
  }),
}));

jest.mock("@/stores/providerSettings", () => ({
  useProviderSettingsStore: () => ({
    isLoading: false,
    isModified: mockIsModified,
    saveSettings: () => mockSaveSettings(),
    markSettingsApplied: () => mockMarkSettingsApplied(),
  }),
}));

jest.mock("@/stores/notification", () => ({
  useNotificationStore: () => ({ scheduleAllNotifications: mockScheduleNotifications }),
}));

jest.mock("@/utils/alarmScheduler", () => ({
  rescheduleAllAlarms: () => mockRescheduleAlarms(),
}));

jest.mock("../../../modules/expo-widget/src", () => ({
  reloadPrayerWidgets: (...args: unknown[]) => mockReloadPrayerWidgets(...args),
}));

jest.mock("@/utils/appLogger", () => ({
  AppLogger: { create: () => ({ d: jest.fn(), i: jest.fn(), w: jest.fn(), e: jest.fn() }) },
}));

const render = async () => {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<ProviderSaveBar />);
  });
  return tree;
};

const pressSave = async (tree: renderer.ReactTestRenderer) => {
  await act(async () => {
    tree.root.findByProps({ testID: "save-button" }).props.onPress();
  });
};

describe("ProviderSaveBar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsModified = true;
  });

  it("stays hidden while there is nothing to apply", async () => {
    mockIsModified = false;

    const tree = await render();

    expect(tree.root.findAllByProps({ testID: "provider-save-bar" })).toHaveLength(0);
  });

  it("appears once the settings are modified", async () => {
    const tree = await render();

    expect(tree.root.findAllByProps({ testID: "provider-save-bar" }).length).toBeGreaterThan(0);
  });

  it("refetches prayer times on every save, not just the first", async () => {
    const tree = await render();

    await pressSave(tree);
    await pressSave(tree);

    expect(mockLoadPrayerTimes).toHaveBeenCalledTimes(2);
    expect(mockLoadPrayerTimes).toHaveBeenNthCalledWith(2, true);
  });

  it("marks the settings applied once the whole pipeline has landed", async () => {
    const tree = await render();

    await pressSave(tree);

    expect(mockMarkSettingsApplied).toHaveBeenCalledTimes(1);
  });

  it("surfaces an error and stays on screen when the refetch fails", async () => {
    mockLoadPrayerTimes.mockRejectedValueOnce(new Error("offline"));

    const tree = await render();
    await pressSave(tree);

    expect(mockShowError).toHaveBeenCalledWith("providers.saveFailed");
    expect(tree.root.findAllByProps({ testID: "save-button" }).length).toBeGreaterThan(0);
  });

  it("leaves the settings unapplied when the refetch fails", async () => {
    mockLoadPrayerTimes.mockRejectedValueOnce(new Error("offline"));

    const tree = await render();
    await pressSave(tree);

    expect(mockMarkSettingsApplied).not.toHaveBeenCalled();
  });

  it("leaves the settings unapplied when rescheduling alarms fails", async () => {
    mockRescheduleAlarms.mockRejectedValueOnce(new Error("alarm store unavailable"));

    const tree = await render();
    await pressSave(tree);

    expect(mockMarkSettingsApplied).not.toHaveBeenCalled();
  });
});
