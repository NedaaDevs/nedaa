import { act, isHiddenFromAccessibility, screen, userEvent } from "@testing-library/react-native";
import { Platform } from "react-native";

import { SoundPicker } from "@/components/ui/sound-picker";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { SOUND_PICKER_GROUP } from "@/constants/sounds";
import { PlatformType } from "@/enums/app";
import i18n from "@/localization/i18n";
import { controlProblems } from "@/test-helpers/controls";
import { renderWithTheme } from "@/test-helpers/theme";
import type { SoundChoiceGroup } from "@/types/sound";
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

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  ...jest.requireActual("expo-router"),
  useRouter: () => ({ push: mockPush }),
}));

const SOUND = { MAKKAH: "makkah", TAKBIR: "takbir", SILENT: "silent", MINE: "custom_1" } as const;
type Sound = (typeof SOUND)[keyof typeof SOUND];

const LABEL = "Sound";
const MAKKAH_SOURCE = 11;
const MINE_URI = "content://media/1";

const GROUPS: readonly SoundChoiceGroup<Sound>[] = [
  {
    id: SOUND_PICKER_GROUP.BUNDLED,
    options: [
      { value: SOUND.MAKKAH, label: "Makkah", previewSource: MAKKAH_SOURCE },
      { value: SOUND.TAKBIR, label: "Takbir", previewSource: 12 },
      { value: SOUND.SILENT, label: "Silent", previewSource: null },
    ],
  },
  {
    id: SOUND_PICKER_GROUP.CUSTOM,
    options: [{ value: SOUND.MINE, label: "My athan", previewSource: MINE_URI }],
  },
];

const renderPicker = ({
  value = SOUND.MAKKAH as Sound,
  onChange = jest.fn(),
  groups = GROUPS,
} = {}) =>
  renderWithTheme(<SoundPicker label={LABEL} groups={groups} value={value} onChange={onChange} />);

const trigger = () => screen.getByRole("button", { name: `${LABEL}, Makkah` });
const preview = (name: string) =>
  screen.getByRole("button", { name: i18n.t("a11y.prayerDetail.soundPicker.preview", { name }) });
const stop = (name: string) =>
  screen.getByRole("button", { name: i18n.t("a11y.prayerDetail.soundPicker.stop", { name }) });
const manage = () => i18n.t("prayerDetail.soundPicker.manageLibrary");

const open = async () => {
  await renderPicker();
  await userEvent.setup().press(trigger());
};

beforeEach(() => {
  jest.replaceProperty(Platform, "OS", PlatformType.ANDROID);
  soundPreviewManager.forceReset();
  mockPlay.mockClear();
  mockStop.mockClear();
  mockPush.mockClear();
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

  it("opens one radio group with a titled section per source", async () => {
    await open();

    expect(trigger()).toHaveProp("accessibilityState", expect.objectContaining({ expanded: true }));
    expect(screen.getByLabelText(LABEL)).toHaveProp("accessibilityRole", "radiogroup");
    expect(screen.getByText(i18n.t("prayerDetail.soundPicker.bundled"))).toBeOnTheScreen();
    expect(screen.getByText(i18n.t("prayerDetail.soundPicker.custom"))).toBeOnTheScreen();
    expect(screen.getAllByRole("radio").map((radio) => radio.props.accessibilityLabel)).toEqual([
      "Makkah",
      "Takbir",
      "Silent",
      "My athan",
    ]);
  });

  it("drops a source with nothing in it", async () => {
    await renderWithTheme(
      <SoundPicker
        label={LABEL}
        groups={[GROUPS[0]!, { id: SOUND_PICKER_GROUP.CUSTOM, options: [] }]}
        value={SOUND.MAKKAH}
        onChange={jest.fn()}
      />
    );
    await userEvent.setup().press(trigger());

    expect(screen.queryByText(i18n.t("prayerDetail.soundPicker.custom"))).not.toBeOnTheScreen();
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

  it("offers no preview for a sound with nothing to play", async () => {
    await open();

    expect(
      screen.queryByRole("button", {
        name: i18n.t("a11y.prayerDetail.soundPicker.preview", { name: "Silent" }),
      })
    ).not.toBeOnTheScreen();
  });

  it("plays a preview through the shared player and offers to stop it", async () => {
    await open();

    await userEvent.setup().press(preview("Makkah"));

    expect(mockPlay).toHaveBeenCalledWith(MAKKAH_SOURCE);
    expect(stop("Makkah")).toBeOnTheScreen();
  });

  it("stops the preview when its stop is pressed", async () => {
    await open();
    const user = userEvent.setup();
    await user.press(preview("Makkah"));

    await user.press(stop("Makkah"));

    expect(mockStop).toHaveBeenCalled();
    expect(preview("Makkah")).toBeOnTheScreen();
  });

  it("plays one preview at a time", async () => {
    await open();
    const user = userEvent.setup();
    await user.press(preview("Makkah"));

    await user.press(preview("My athan"));

    expect(mockPlay).toHaveBeenLastCalledWith(MINE_URI);
    expect(stop("My athan")).toBeOnTheScreen();
    expect(preview("Makkah")).toBeOnTheScreen();
  });

  it("shows play again once a preview ends by itself", async () => {
    await open();
    await userEvent.setup().press(preview("Makkah"));

    await act(() => mockFinish?.());

    expect(preview("Makkah")).toBeOnTheScreen();
  });

  it("stops its preview when the list closes", async () => {
    await open();
    const user = userEvent.setup();
    await user.press(preview("Makkah"));

    await user.press(trigger());

    expect(mockStop).toHaveBeenCalled();
    expect(soundPreviewManager.isCurrentlyPlaying()).toBe(false);
  });

  it("stops its preview when it leaves the screen", async () => {
    await open();
    await userEvent.setup().press(preview("Makkah"));

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

  it("links to the custom sound library", async () => {
    await open();

    await userEvent.setup().press(screen.getByRole("button", { name: manage() }));

    expect(mockPush).toHaveBeenCalledWith(BACK_DESTINATION.SETTINGS_CUSTOM_SOUNDS.href);
  });

  // Custom sounds exist only on Android.
  it("offers no library link on iOS", async () => {
    jest.replaceProperty(Platform, "OS", PlatformType.IOS);
    await open();

    expect(screen.queryByRole("button", { name: manage() })).not.toBeOnTheScreen();
  });
});
