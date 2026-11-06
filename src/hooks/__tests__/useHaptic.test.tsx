import * as Haptics from "expo-haptics";
import { renderHook } from "@testing-library/react-native";

import { HAPTIC_FEEDBACK, type HapticFeedback } from "@/constants/Haptics";
import { useHaptic } from "@/hooks/useHaptic";
import { usePreferencesStore } from "@/stores/preferences";

jest.mock("expo-haptics", () => {
  const actual = jest.requireActual("expo-haptics");
  return {
    ImpactFeedbackStyle: actual.ImpactFeedbackStyle,
    NotificationFeedbackType: actual.NotificationFeedbackType,
    impactAsync: jest.fn(async () => {}),
    notificationAsync: jest.fn(async () => {}),
    selectionAsync: jest.fn(async () => {}),
  };
});

/** The device call each feedback type plays; a new type must be added here. */
const PLAYS: Record<HapticFeedback, () => void> = {
  [HAPTIC_FEEDBACK.LIGHT]: () =>
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light),
  [HAPTIC_FEEDBACK.MEDIUM]: () =>
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium),
  [HAPTIC_FEEDBACK.HEAVY]: () =>
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Heavy),
  [HAPTIC_FEEDBACK.SELECTION]: () => expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1),
  [HAPTIC_FEEDBACK.SUCCESS]: () =>
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Success
    ),
  [HAPTIC_FEEDBACK.WARNING]: () =>
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Warning
    ),
  [HAPTIC_FEEDBACK.ERROR]: () =>
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Error),
};

const play = async (type?: HapticFeedback) => {
  const { result } = await renderHook(() => useHaptic(type));
  await result.current();
};

/** How many device calls played, of any kind. */
const played = () =>
  [Haptics.impactAsync, Haptics.notificationAsync, Haptics.selectionAsync]
    .map((call) => jest.mocked(call).mock.calls.length)
    .reduce((sum, count) => sum + count, 0);

beforeEach(() => {
  jest.clearAllMocks();
  usePreferencesStore.setState({ hapticsEnabled: true });
});

describe("useHaptic", () => {
  it.each(Object.values(HAPTIC_FEEDBACK))("plays %s feedback", async (type) => {
    await play(type);

    PLAYS[type]();
    expect(played()).toBe(1);
  });

  it("plays selection feedback by default", async () => {
    await play();

    PLAYS[HAPTIC_FEEDBACK.SELECTION]();
  });

  it("plays nothing while haptics are off", async () => {
    usePreferencesStore.setState({ hapticsEnabled: false });

    for (const type of Object.values(HAPTIC_FEEDBACK)) await play(type);

    expect(played()).toBe(0);
  });
});
