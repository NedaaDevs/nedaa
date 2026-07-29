import React from "react";
import renderer, { act } from "react-test-renderer";

import AladhanSettings from "@/components/AladhanSettings";

const mockLoadPrayerTimes = jest.fn(() => Promise.resolve());
// Mirrors the store: the dirty flag survives the save and is cleared by the caller
// once the whole apply pipeline has landed.
let mockIsModified = true;
const mockSaveSettings = jest.fn(() => Promise.resolve());
const mockMarkSettingsApplied = jest.fn(() => {
  mockIsModified = false;
});
const mockScheduleNotifications = jest.fn(() => Promise.resolve());
const mockRescheduleAlarms = jest.fn(() => Promise.resolve());
const mockReloadPrayerWidgets = jest.fn();
const mockShowError = jest.fn();

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("@/hooks/useHaptic", () => ({
  useHaptic: () => jest.fn(),
}));

jest.mock("@/components/ui/box", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View: RNView } = require("react-native");
  return { Box: RNView };
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

jest.mock("@/components/AladhanSettings/MethodSettings", () => ({ MethodSettings: () => null }));
jest.mock("@/components/AladhanSettings/SchoolSettings", () => ({ SchoolSettings: () => null }));
jest.mock("@/components/AladhanSettings/MidnightModeSettings", () => ({
  MidnightModeSettings: () => null,
}));
jest.mock("@/components/AladhanSettings/TuningSettings", () => ({ TuningSettings: () => null }));

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
    saveSettings: (...args: unknown[]) => mockSaveSettings(...(args as [])),
    markSettingsApplied: () => mockMarkSettingsApplied(),
  }),
}));

jest.mock("@/utils/appLogger", () => ({
  AppLogger: {
    create: () => ({ d: jest.fn(), i: jest.fn(), w: jest.fn(), e: jest.fn() }),
  },
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

jest.mock("@/components/feedback", () => ({
  MessageToast: { showError: (...args: unknown[]) => mockShowError(...args) },
}));

const renderSettings = async () => {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<AladhanSettings />);
  });
  return tree;
};

const pressSave = async (tree: renderer.ReactTestRenderer) => {
  await act(async () => {
    tree.root.findByProps({ testID: "save-button" }).props.onPress();
  });
};

describe("AladhanSettings save", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsModified = true;
  });

  it("refetches prayer times on every save, not just the first", async () => {
    const tree = await renderSettings();

    await pressSave(tree);
    await pressSave(tree);

    expect(mockLoadPrayerTimes).toHaveBeenCalledTimes(2);
    expect(mockLoadPrayerTimes).toHaveBeenNthCalledWith(2, true);
  });

  it("surfaces an error and keeps save available when the refetch fails", async () => {
    mockLoadPrayerTimes.mockRejectedValueOnce(new Error("offline"));

    const tree = await renderSettings();
    await pressSave(tree);

    expect(mockShowError).toHaveBeenCalledWith("providers.saveFailed");
    expect(tree.root.findAllByProps({ testID: "save-button" }).length).toBeGreaterThan(0);
  });

  it("marks the settings applied once the whole pipeline has landed", async () => {
    const tree = await renderSettings();

    await pressSave(tree);

    expect(mockMarkSettingsApplied).toHaveBeenCalledTimes(1);
  });

  it("leaves the settings unapplied when the refetch fails", async () => {
    mockLoadPrayerTimes.mockRejectedValueOnce(new Error("offline"));

    const tree = await renderSettings();
    await pressSave(tree);

    expect(mockMarkSettingsApplied).not.toHaveBeenCalled();
  });

  it("leaves the settings unapplied when rescheduling alarms fails", async () => {
    mockRescheduleAlarms.mockRejectedValueOnce(new Error("alarm store unavailable"));

    const tree = await renderSettings();
    await pressSave(tree);

    expect(mockMarkSettingsApplied).not.toHaveBeenCalled();
  });
});
