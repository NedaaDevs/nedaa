import { screen, userEvent } from "@testing-library/react-native";
import { Platform } from "react-native";

import { AthanGroup } from "@/components/prayer-detail/AthanGroup";
import { NOTIFICATION_TYPE } from "@/constants/Notification";
import { PRAYER_ID } from "@/constants/Prayer";
import type { PrayerSoundKey } from "@/constants/sounds";
import { PlatformType } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useCustomSoundsStore } from "@/stores/customSounds";
import { useNotificationStore } from "@/stores/notification";
import { controlProblems } from "@/test-helpers/controls";
import { renderWithTheme } from "@/test-helpers/theme";
import { CUSTOM_SOUND_KEY_PREFIX, type CustomSound } from "@/types/customSound";
import { getEffectiveConfig } from "@/types/notification";
import { getSoundChoiceGroups } from "@/utils/sound";

jest.mock("expo-linking", () => ({ openSettings: jest.fn() }));
jest.mock("@/utils/notifications", () => ({ cancelAllScheduledNotifications: jest.fn() }));
jest.mock("@/utils/notificationScheduler", () => ({
  scheduleAllNotifications: jest.fn(() => Promise.resolve({ success: true, scheduledCount: 0 })),
  shouldReschedule: jest.fn(() => false),
}));
jest.mock("@/utils/customSoundManager", () => ({ buildUsedSoundsSet: jest.fn(() => new Set()) }));
jest.mock("@/services/qada-db", () => ({
  QadaDB: {
    flush: jest.fn(),
    getSettings: jest.fn(() => Promise.resolve(null)),
    getRemainingCount: jest.fn(() => Promise.resolve(0)),
  },
}));
jest.mock("@/stores/location", () => ({
  __esModule: true,
  default: { getState: jest.fn(() => ({ locationDetails: { timezone: "UTC" } })) },
}));
jest.mock("@/stores/prayerTimes", () => ({
  __esModule: true,
  default: { getState: jest.fn(() => ({ twoWeeksTimings: [] })) },
}));
jest.mock("@/services/audio/previewPlayer", () => ({
  playPreview: jest.fn(() => Promise.resolve()),
  stopPreview: jest.fn(() => Promise.resolve()),
  addPreviewListener: jest.fn(() => () => {}),
}));
jest.mock("expo-router", () => ({
  ...jest.requireActual("expo-router"),
  useRouter: () => ({ push: jest.fn() }),
}));

const PRAYER = PRAYER_ID.FAJR;
const OTHER_SOUND: PrayerSoundKey = "athan2";

const MY_ATHAN: CustomSound = {
  id: `${CUSTOM_SOUND_KEY_PREFIX}1`,
  name: "My athan",
  contentUri: "content://media/1",
  fileName: "my-athan.mp3",
  fileSize: 1,
  fileIdentifier: "content://media/1:1",
  availableFor: [NOTIFICATION_TYPE.PRAYER],
  dateAdded: "2026-09-01T00:00:00.000Z",
};

const INITIAL_SETTINGS = useNotificationStore.getState().settings;
const DEFAULTS = INITIAL_SETTINGS.defaults.prayer;

const TITLE = i18n.t("prayerDetail.athan.title");
const SOUND_LABEL = i18n.t("prayerDetail.athan.sound");
const VIBRATION = i18n.t("prayerDetail.athan.vibration");

const soundName = (key: string) =>
  getSoundChoiceGroups(NOTIFICATION_TYPE.PRAYER, [MY_ATHAN], i18n.t)
    .flatMap((group) => group.options)
    .find((option) => option.value === key)!.label;

const effective = () => {
  const { defaults, overrides } = useNotificationStore.getState().settings;
  return getEffectiveConfig(PRAYER, NOTIFICATION_TYPE.PRAYER, defaults, overrides);
};

const setOverride = (override: object) =>
  useNotificationStore.setState({
    settings: { ...INITIAL_SETTINGS, overrides: { [PRAYER]: { prayer: override } } },
  });

const group = () => screen.getByRole("switch", { name: new RegExp(`^${TITLE}`) });
const vibration = () => screen.queryByRole("switch", { name: VIBRATION });
const soundTrigger = () => screen.queryByRole("button", { name: new RegExp(`^${SOUND_LABEL}, `) });

beforeEach(() => {
  jest.replaceProperty(Platform, "OS", PlatformType.ANDROID);
  useNotificationStore.setState({
    settings: { ...INITIAL_SETTINGS, overrides: {} },
    pendingReschedule: false,
    batchDepth: 0,
  });
  useCustomSoundsStore.setState({ customSounds: [MY_ATHAN] });
});

describe("AthanGroup", () => {
  it("reads the chosen sound as its summary and opens while on", async () => {
    await renderWithTheme(<AthanGroup prayerId={PRAYER} />);

    expect(group()).toHaveAccessibleName(`${TITLE}, ${soundName(DEFAULTS.sound)}`);
    expect(group()).toBeChecked();
    expect(soundTrigger()).toBeOnTheScreen();
  });

  it("reads off and stays closed while off", async () => {
    setOverride({ enabled: false });
    await renderWithTheme(<AthanGroup prayerId={PRAYER} />);

    expect(group()).toHaveAccessibleName(`${TITLE}, ${i18n.t("prayerDetail.athan.off")}`);
    expect(group()).not.toBeChecked();
    expect(soundTrigger()).not.toBeOnTheScreen();
    expect(vibration()).not.toBeOnTheScreen();
  });

  it("writes the switch to this prayer at once", async () => {
    await renderWithTheme(<AthanGroup prayerId={PRAYER} />);

    await userEvent.setup().press(group());

    expect(effective().enabled).toBe(false);
    expect(soundTrigger()).not.toBeOnTheScreen();
  });

  it("lists your own sounds and writes a picked one at once", async () => {
    await renderWithTheme(<AthanGroup prayerId={PRAYER} />);
    const user = userEvent.setup();

    await user.press(soundTrigger()!);
    await user.press(screen.getByRole("radio", { name: MY_ATHAN.name }));

    expect(effective().sound).toBe(MY_ATHAN.id);
    expect(group()).toHaveAccessibleName(`${TITLE}, ${MY_ATHAN.name}`);
  });

  // A pill tap never erases the custom sound.
  it("keeps a custom sound when another field changes", async () => {
    setOverride({ sound: MY_ATHAN.id });
    await renderWithTheme(<AthanGroup prayerId={PRAYER} />);
    const user = userEvent.setup();

    await user.press(vibration()!);
    expect(effective()).toEqual({
      ...DEFAULTS,
      sound: MY_ATHAN.id,
      vibration: !DEFAULTS.vibration,
    });

    await user.press(group());
    await user.press(group());
    expect(effective()).toEqual({
      ...DEFAULTS,
      sound: MY_ATHAN.id,
      vibration: !DEFAULTS.vibration,
    });
  });

  it("keeps the other fields when the sound changes", async () => {
    setOverride({ vibration: !DEFAULTS.vibration });
    await renderWithTheme(<AthanGroup prayerId={PRAYER} />);
    const user = userEvent.setup();

    await user.press(soundTrigger()!);
    await user.press(screen.getByRole("radio", { name: soundName(OTHER_SOUND) }));

    expect(effective()).toEqual({
      ...DEFAULTS,
      sound: OTHER_SOUND,
      vibration: !DEFAULTS.vibration,
    });
  });

  it("writes vibration on Android", async () => {
    await renderWithTheme(<AthanGroup prayerId={PRAYER} />);

    expect(vibration()).toHaveProp(
      "accessibilityState",
      expect.objectContaining({ checked: DEFAULTS.vibration })
    );
    await userEvent.setup().press(vibration()!);

    expect(effective().vibration).toBe(!DEFAULTS.vibration);
  });

  // iOS takes vibration from the device, not from the notification.
  it("has no vibration switch on iOS", async () => {
    jest.replaceProperty(Platform, "OS", PlatformType.IOS);
    await renderWithTheme(<AthanGroup prayerId={PRAYER} />);

    expect(soundTrigger()).toBeOnTheScreen();
    expect(vibration()).not.toBeOnTheScreen();
  });

  it("gives every control a role, a name and a 44pt target", async () => {
    await renderWithTheme(<AthanGroup prayerId={PRAYER} />);

    expect(controlProblems()).toEqual([]);
  });
});
