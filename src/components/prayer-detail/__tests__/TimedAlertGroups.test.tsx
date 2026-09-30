import type { ComponentType } from "react";
import { Platform } from "react-native";
import { screen, userEvent } from "@testing-library/react-native";

import { IqamaGroup } from "@/components/prayer-detail/IqamaGroup";
import { PreAthanGroup } from "@/components/prayer-detail/PreAthanGroup";
import {
  NOTIFICATION_FIELD,
  NOTIFICATION_TIMING_CHOICES,
  NOTIFICATION_TYPE,
} from "@/constants/Notification";
import { PRAYER_ID, type PrayerId } from "@/constants/Prayer";
import { SOUND_ASSETS } from "@/constants/sounds";
import { PlatformType } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useNotificationStore } from "@/stores/notification";
import { controlProblems } from "@/test-helpers/controls";
import { renderWithTheme } from "@/test-helpers/theme";
import type { ConfigForType } from "@/types/notification";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
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

type TimedType = typeof NOTIFICATION_TYPE.IQAMA | typeof NOTIFICATION_TYPE.PRE_ATHAN;

const PLATFORM = Platform.OS;
const PRAYER = PRAYER_ID.ASR;
const OTHER_PRAYER = PRAYER_ID.ISHA;
// Not one of the pills, as an older build or a restored backup may hold.
const OFF_LIST_MINUTES = 7;
const BEEP = "beep";

const store = () => useNotificationStore.getState();
const INITIAL_SETTINGS = store().settings;

const overrideOf = (prayerId: PrayerId, type: TimedType) =>
  store().settings.overrides[prayerId]?.[type];

// A write equal to the default clears the field, so assert what the prayer resolves to.
const effective = (type: TimedType) => store().getEffectiveConfigForPrayer(PRAYER, type);

const seed = <T extends TimedType>(type: T, config: Partial<ConfigForType<T>>) =>
  store().replaceOverride(PRAYER, type, config);

const CASES = [
  {
    type: NOTIFICATION_TYPE.IQAMA,
    other: NOTIFICATION_TYPE.PRE_ATHAN,
    Group: IqamaGroup,
    title: "prayerDetail.iqama.title",
    summary: "prayerDetail.iqama.summary",
    timing: "prayerDetail.iqama.timing",
    direction: "after the Athan",
  },
  {
    type: NOTIFICATION_TYPE.PRE_ATHAN,
    other: NOTIFICATION_TYPE.IQAMA,
    Group: PreAthanGroup,
    title: "prayerDetail.preAthan.title",
    summary: "prayerDetail.preAthan.summary",
    timing: "prayerDetail.preAthan.timing",
    direction: "before the Athan",
  },
] as const satisfies readonly {
  type: TimedType;
  other: TimedType;
  Group: ComponentType<{ prayerId: PrayerId }>;
  title: string;
  summary: string;
  timing: string;
  direction: string;
}[];

beforeEach(() => {
  useNotificationStore.setState({
    settings: { ...INITIAL_SETTINGS, overrides: {} },
    pendingReschedule: false,
    batchDepth: 0,
  });
});

afterEach(() => {
  Platform.OS = PLATFORM;
});

describe.each(CASES)("$type group", ({ type, other, Group, title, summary, timing, direction }) => {
  const groupSwitch = () => screen.getByRole("switch", { name: new RegExp(`^${i18n.t(title)}, `) });
  const pill = (minutes: number) =>
    screen.getByRole("radio", { name: `${minutes} minutes ${direction}` });

  it("reads Off and shows no body while off", async () => {
    await seed(type, { enabled: false });
    await renderWithTheme(<Group prayerId={PRAYER} />);

    expect(groupSwitch().props.accessibilityLabel).toBe(
      `${i18n.t(title)}, ${i18n.t("common.off")}`
    );
    expect(groupSwitch().props.accessibilityState).toMatchObject({ checked: false });
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });

  it("reads its minutes, which side of the Athan they fall, and its sound", async () => {
    await seed(type, { enabled: true, timing: 15, sound: BEEP });
    await renderWithTheme(<Group prayerId={PRAYER} />);

    const label = groupSwitch().props.accessibilityLabel;
    expect(label).toContain(`15 minutes ${direction}`);
    expect(label).toContain(i18n.t(SOUND_ASSETS[BEEP].label));
  });

  it("inflects the summary with the count", async () => {
    await seed(type, { enabled: true, timing: 1 });
    await renderWithTheme(<Group prayerId={PRAYER} />);

    expect(groupSwitch().props.accessibilityLabel).toContain(`1 minute ${direction}`);
  });

  it("turns on for this prayer only, and opens its body", async () => {
    await seed(type, { enabled: false });
    await renderWithTheme(<Group prayerId={PRAYER} />);

    await userEvent.press(groupSwitch());

    expect(overrideOf(PRAYER, type)?.enabled).toBe(true);
    expect(overrideOf(OTHER_PRAYER, type)).toBeUndefined();
    expect(screen.getAllByRole("radio").length).toBeGreaterThanOrEqual(
      NOTIFICATION_TIMING_CHOICES.length
    );
  });

  it("offers every timing choice as a pill named with its unit, the stored one selected", async () => {
    await seed(type, { enabled: true, timing: 20 });
    await renderWithTheme(<Group prayerId={PRAYER} />);

    expect(screen.getByLabelText(i18n.t(timing))).toHaveProp("accessibilityRole", "radiogroup");
    for (const minutes of NOTIFICATION_TIMING_CHOICES) {
      expect(pill(minutes).props.accessibilityState).toMatchObject({ selected: minutes === 20 });
    }
    expect(screen.getByText("20")).toBeTruthy();
  });

  // iOS reads no name on the pill group, so each pill carries its side of the Athan.
  it("names every pill with its side of the Athan", async () => {
    await seed(type, { enabled: true });
    await renderWithTheme(<Group prayerId={PRAYER} />);

    expect(screen.getAllByRole("radio").slice(0, NOTIFICATION_TIMING_CHOICES.length)).toEqual(
      NOTIFICATION_TIMING_CHOICES.map(pill)
    );
  });

  it("writes a picked pill without touching the other type", async () => {
    await seed(type, { enabled: true, timing: 20 });
    await store().replaceOverride(PRAYER, other, { enabled: true, timing: 30 });
    await renderWithTheme(<Group prayerId={PRAYER} />);

    await userEvent.press(pill(5));

    expect(overrideOf(PRAYER, type)).toMatchObject({ enabled: true, timing: 5 });
    expect(overrideOf(PRAYER, other)).toEqual({ enabled: true, timing: 30 });
  });

  it("selects no pill and writes nothing for a stored timing outside the list", async () => {
    await seed(type, { enabled: true, timing: OFF_LIST_MINUTES });
    await renderWithTheme(<Group prayerId={PRAYER} />);

    expect(groupSwitch().props.accessibilityLabel).toContain(
      `${OFF_LIST_MINUTES} minutes ${direction}`
    );
    for (const minutes of NOTIFICATION_TIMING_CHOICES) {
      expect(pill(minutes).props.accessibilityState).toMatchObject({ selected: false });
    }
    expect(overrideOf(PRAYER, type)).toEqual({ enabled: true, timing: OFF_LIST_MINUTES });

    await userEvent.press(pill(10));

    expect(effective(type).timing).toBe(10);
  });

  it("writes a picked sound", async () => {
    await seed(type, { enabled: true });
    await renderWithTheme(<Group prayerId={PRAYER} />);

    await userEvent.press(
      screen.getByRole("button", { name: new RegExp(`^${i18n.t("notification.sound")}, `) })
    );
    await userEvent.press(screen.getByRole("radio", { name: i18n.t(SOUND_ASSETS[BEEP].label) }));

    expect(effective(type).sound).toBe(BEEP);
  });

  it("offers vibration on Android, and writes it", async () => {
    Platform.OS = PlatformType.ANDROID;
    await seed(type, { enabled: true, vibration: false });
    await renderWithTheme(<Group prayerId={PRAYER} />);

    const vibration = screen.getByRole("switch", {
      name: new RegExp(`^${i18n.t("notification.vibration")}`),
    });
    await userEvent.press(vibration);

    expect(effective(type).vibration).toBe(true);
  });

  it("offers no vibration on iOS", async () => {
    Platform.OS = PlatformType.IOS;
    await seed(type, { enabled: true });
    await renderWithTheme(<Group prayerId={PRAYER} />);

    expect(
      screen.queryByRole("switch", { name: new RegExp(`^${i18n.t("notification.vibration")}`) })
    ).toBeNull();
  });

  it("gives every control a role, a name and a 44pt target", async () => {
    Platform.OS = PlatformType.ANDROID;
    await seed(type, { enabled: true });
    await renderWithTheme(<Group prayerId={PRAYER} />);

    expect(controlProblems()).toEqual([]);
  });
});

describe("Iqama and pre-Athan groups together", () => {
  it("keep their writes apart on the same prayer", async () => {
    await renderWithTheme(
      <>
        <IqamaGroup prayerId={PRAYER} />
        <PreAthanGroup prayerId={PRAYER} />
      </>
    );

    await userEvent.press(
      screen.getByRole("switch", { name: new RegExp(`^${i18n.t("prayerDetail.iqama.title")}, `) })
    );

    expect(overrideOf(PRAYER, NOTIFICATION_TYPE.IQAMA)).toEqual({ enabled: true });
    expect(overrideOf(PRAYER, NOTIFICATION_TYPE.PRE_ATHAN)).toBeUndefined();
    expect(
      screen.getByRole("switch", {
        name: new RegExp(`^${i18n.t("prayerDetail.preAthan.title")}, `),
      }).props.accessibilityState
    ).toMatchObject({ checked: false });
    expect(store().settings.defaults[NOTIFICATION_TYPE.IQAMA][NOTIFICATION_FIELD.ENABLED]).toBe(
      INITIAL_SETTINGS.defaults.iqama.enabled
    );
  });
});
