import { screen, userEvent } from "@testing-library/react-native";

import { FocusAudioButton } from "@/components/athkar/session/FocusAudioButton";
import { FOCUS_CONTROL_PART } from "@/components/athkar/session/FocusControl";
import i18n from "@/localization/i18n";
import { renderWithTheme } from "@/test-helpers/theme";
import { PLAYER_STATE, type PlayerState } from "@/types/athkar-audio";

jest.mock("expo-blur", () => jest.requireActual("@/test-helpers/blurMock"));

const t = i18n.t.bind(i18n);
const START = "a11y.athkar.startAudioSession";
const PAUSE = "a11y.athkar.audioPause";
const LOADING = "a11y.athkar.audioPreparing";

describe("FocusAudioButton", () => {
  it.each<[PlayerState, string]>([
    [PLAYER_STATE.IDLE, START],
    [PLAYER_STATE.ENDED, START],
    [PLAYER_STATE.PAUSED, START],
    [PLAYER_STATE.PLAYING, PAUSE],
    [PLAYER_STATE.LOADING, LOADING],
  ])("names what a press does while %s", async (state, key) => {
    await renderWithTheme(<FocusAudioButton state={state} onPress={jest.fn()} />);
    expect(screen.getByRole("button", { name: t(key) })).toBeOnTheScreen();
  });

  it("is filled only while the audio plays", async () => {
    const view = await renderWithTheme(
      <FocusAudioButton state={PLAYER_STATE.PLAYING} onPress={jest.fn()} />
    );
    expect(screen.getByTestId(FOCUS_CONTROL_PART.FILL)).toBeOnTheScreen();
    await view.rerender(<FocusAudioButton state={PLAYER_STATE.PAUSED} onPress={jest.fn()} />);
    expect(screen.queryByTestId(FOCUS_CONTROL_PART.FILL)).toBeNull();
  });

  it("reports a press", async () => {
    const onPress = jest.fn();
    await renderWithTheme(<FocusAudioButton state={PLAYER_STATE.IDLE} onPress={onPress} />);
    await userEvent.press(screen.getByRole("button"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("takes no press while the audio loads, and says so without a busy state", async () => {
    const onPress = jest.fn();
    await renderWithTheme(<FocusAudioButton state={PLAYER_STATE.LOADING} onPress={onPress} />);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    // iOS speaks "busy" in English whatever the app's language.
    expect(button).not.toBeBusy();
    await userEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});
