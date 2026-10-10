import {
  act,
  isHiddenFromAccessibility,
  screen,
  userEvent,
  within,
} from "@testing-library/react-native";

import { SoundPicker } from "@/components/ui/sound-picker";
import i18n from "@/localization/i18n";
import { controlProblems } from "@/test-helpers/controls";
import { renderWithTheme } from "@/test-helpers/theme";
import type { SoundChoice } from "@/types/sound";
import { soundPreviewManager } from "@/utils/sound";

const mockPlay = jest.fn<Promise<void>, [string | number]>(() => Promise.resolve());
const mockStop = jest.fn(() => Promise.resolve());
let mockFinish: (() => void) | null = null;

jest.mock("@/services/audio/previewPlayer", () => ({
  playPreview: (source: string | number) => mockPlay(source),
  stopPreview: () => mockStop(),
  addPreviewListener: (listener: (status: { didJustFinish: boolean }) => void) => {
    mockFinish = () => listener({ didJustFinish: true });
    return () => {
      mockFinish = null;
    };
  },
}));

const SOUND = { MAKKAH: "makkah", TAKBIR: "takbir", SILENT: "silent", MINE: "custom_1" } as const;
type Sound = (typeof SOUND)[keyof typeof SOUND];

const LABEL = "Sound";
const MAKKAH_SOURCE = 11;
const MINE_URI = "content://media/1";

const OPTIONS: readonly SoundChoice<Sound>[] = [
  { value: SOUND.MAKKAH, label: "Makkah", previewSource: MAKKAH_SOURCE },
  { value: SOUND.TAKBIR, label: "Takbir", previewSource: 12 },
  { value: SOUND.SILENT, label: "Silent", previewSource: null },
  { value: SOUND.MINE, label: "My athan", previewSource: MINE_URI },
];

const renderPicker = ({ value = SOUND.MAKKAH as Sound, onChange = jest.fn() } = {}) =>
  renderWithTheme(
    <SoundPicker label={LABEL} options={OPTIONS} value={value} onChange={onChange} />
  );

const trigger = (name = "Makkah") => screen.getByRole("button", { name: `${LABEL}, ${name}` });
const preview = (name = "Makkah") =>
  screen.getByRole("button", { name: i18n.t("a11y.prayerDetail.soundPicker.preview", { name }) });
const stop = (name = "Makkah") =>
  screen.getByRole("button", { name: i18n.t("a11y.prayerDetail.soundPicker.stop", { name }) });

const open = async () => {
  await renderPicker();
  await userEvent.setup().press(trigger());
};

beforeEach(() => {
  soundPreviewManager.forceReset();
  mockPlay.mockClear();
  mockStop.mockClear();
});

describe("SoundPicker", () => {
  it("names the chosen sound on a collapsed trigger", async () => {
    await renderPicker();

    expect(trigger()).toHaveProp(
      "accessibilityState",
      expect.objectContaining({ expanded: false })
    );
    expect(screen.queryByRole("radio")).not.toBeOnTheScreen();
  });

  // The trigger speaks the label, so the reader hears it once.
  it("captions the trigger with its label, hidden from a screen reader", async () => {
    await renderPicker();

    const caption = screen.getByText(LABEL, { includeHiddenElements: true });
    expect(isHiddenFromAccessibility(caption)).toBe(true);
    expect(trigger()).toBeOnTheScreen();
  });

  it("opens one flat radio group of every sound", async () => {
    await open();

    expect(trigger()).toHaveProp("accessibilityState", expect.objectContaining({ expanded: true }));
    expect(screen.getByLabelText(LABEL)).toHaveProp("accessibilityRole", "radiogroup");
    expect(screen.queryByRole("header")).not.toBeOnTheScreen();
    expect(screen.getAllByRole("radio").map((radio) => radio.props.accessibilityLabel)).toEqual([
      "Makkah",
      "Takbir",
      "Silent",
      "My athan",
    ]);
  });

  it("reads only the chosen sound as selected", async () => {
    await open();

    const selected = screen.getAllByRole("radio", { selected: true });

    expect(selected.map((radio) => radio.props.accessibilityLabel)).toEqual(["Makkah"]);
  });

  it("reports the sound picked and closes the list", async () => {
    const onChange = jest.fn();
    await renderPicker({ onChange });
    const user = userEvent.setup();
    await user.press(trigger());

    await user.press(screen.getByRole("radio", { name: "My athan" }));

    expect(onChange).toHaveBeenCalledWith(SOUND.MINE);
    expect(screen.queryByRole("radio")).not.toBeOnTheScreen();
  });

  it("closes without a write when the chosen sound is picked again", async () => {
    const onChange = jest.fn();
    await renderPicker({ onChange });
    const user = userEvent.setup();
    await user.press(trigger());

    await user.press(screen.getByRole("radio", { name: "Makkah" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("radio")).not.toBeOnTheScreen();
  });

  it("gives every control a role, a name and a 44pt target", async () => {
    await open();

    expect(controlProblems()).toEqual([]);
  });

  // One preview beside the trigger plays the chosen sound, open or closed.
  it("offers one preview, for the chosen sound, outside the list", async () => {
    await open();

    const prefix = i18n.t("a11y.prayerDetail.soundPicker.preview", { name: "" }).trim();
    const previews = screen
      .getAllByRole("button")
      .filter((button) => String(button.props.accessibilityLabel).startsWith(prefix));

    expect(previews).toEqual([preview()]);
    expect(within(screen.getByLabelText(LABEL)).queryAllByRole("button")).toHaveLength(0);
  });

  it("disables the preview when the chosen sound has nothing to play", async () => {
    await renderPicker({ value: SOUND.SILENT });

    await userEvent.setup().press(preview("Silent"));

    expect(preview("Silent")).toHaveProp(
      "accessibilityState",
      expect.objectContaining({ disabled: true })
    );
    expect(mockPlay).not.toHaveBeenCalled();
  });

  it("plays the chosen sound through the shared player and offers to stop it", async () => {
    await renderPicker();

    await userEvent.setup().press(preview());

    expect(mockPlay).toHaveBeenCalledWith(MAKKAH_SOURCE);
    expect(stop()).toBeOnTheScreen();
  });

  it("stops the preview when its stop is pressed", async () => {
    await renderPicker();
    const user = userEvent.setup();
    await user.press(preview());

    await user.press(stop());

    expect(mockStop).toHaveBeenCalled();
    expect(preview()).toBeOnTheScreen();
  });

  it("shows play again once a preview ends by itself", async () => {
    await renderPicker();
    await userEvent.setup().press(preview());

    await act(() => mockFinish?.());

    expect(preview()).toBeOnTheScreen();
  });

  it("stops the preview when another sound is picked", async () => {
    const onChange = jest.fn();
    await renderPicker({ onChange });
    const user = userEvent.setup();
    await user.press(preview());
    await user.press(trigger());

    await user.press(screen.getByRole("radio", { name: "Takbir" }));

    expect(mockStop).toHaveBeenCalled();
    expect(soundPreviewManager.isCurrentlyPlaying()).toBe(false);
  });

  it("stops its preview when it leaves the screen", async () => {
    await renderPicker();
    await userEvent.setup().press(preview());

    await act(async () => screen.unmount());

    expect(mockStop).toHaveBeenCalled();
  });

  // A preview another screen started is that screen's to stop.
  it("leaves a preview it did not start playing", async () => {
    await open();
    await act(() => soundPreviewManager.playSource("elsewhere", 99));
    mockStop.mockClear();

    await act(async () => screen.unmount());

    expect(mockStop).not.toHaveBeenCalled();
  });
});
