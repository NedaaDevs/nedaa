import { Platform } from "react-native";
import { screen, userEvent } from "@testing-library/react-native";

import CustomSoundsScreen from "@/app/settings/customSounds";
import { NOTIFICATION_TYPE } from "@/constants/Notification";
import { AppLocale, PlatformType } from "@/enums/app";
import i18n from "@/localization/i18n";
import { renderWithTheme } from "@/test-helpers/theme";
import type { CustomSound } from "@/types/customSound";
import { LTR_ISOLATE } from "@/utils/digits";
import { formatFileSizeLocale } from "@/utils/number";
import { soundPreviewManager } from "@/utils/sound";

const SOUND: CustomSound = {
  id: "custom_1",
  fileIdentifier: "dawn-call",
  dateAdded: "2026-01-01T00:00:00.000Z",
  name: "Dawn",
  fileName: "dawn-call.mp3",
  contentUri: "content://media/audio/1",
  fileSize: 2048,
  availableFor: [NOTIFICATION_TYPE.PRAYER],
};

const mockPlay = jest.fn<Promise<void>, [string | number]>(() => Promise.resolve());

jest.mock("@/services/audio/previewPlayer", () => ({
  playPreview: (source: string | number) => mockPlay(source),
  stopPreview: () => Promise.resolve(),
  addPreviewListener: () => () => {},
}));
jest.mock("@/components/ui/screen-header", () => ({ ScreenHeader: () => null }));
jest.mock("@/components/AddCustomSoundModal", () => () => null);
jest.mock("@/hooks/useHaptic", () => ({ useHaptic: () => jest.fn() }));
jest.mock("@/stores/customSounds", () => ({
  useCustomSoundsStore: () => ({
    customSounds: [mockSound()],
    isInitialized: true,
    initialize: jest.fn(),
    addCustomSound: jest.fn(),
    deleteCustomSound: jest.fn(),
  }),
}));
jest.mock("@/stores/notification", () => ({
  useNotificationStore: () => ({
    settings: {},
    updateSettings: jest.fn(),
    getUsedCustomSounds: () => new Set(),
  }),
}));
jest.mock("@/utils/customSoundManager", () => ({
  calculateTotalStorage: () => 0,
  CUSTOM_SOUND_REPLACEMENT: "beep",
}));

const mockSound = () => SOUND;
const t = i18n.t.bind(i18n);

describe("Custom sounds", () => {
  beforeAll(() => i18n.changeLanguage(AppLocale.EN));

  beforeEach(() => {
    jest.replaceProperty(Platform, "OS", PlatformType.ANDROID);
    soundPreviewManager.forceReset();
    mockPlay.mockClear();
  });

  it("plays the file and names the stop action while it plays", async () => {
    await renderWithTheme(<CustomSoundsScreen />);

    await userEvent.press(
      screen.getByRole("button", {
        name: t("a11y.customSound.previewSound", { name: SOUND.name }),
      })
    );

    expect(mockPlay).toHaveBeenCalledWith(SOUND.contentUri);
    expect(
      await screen.findByRole("button", {
        name: t("a11y.customSound.stopSound", { name: SOUND.name }),
      })
    ).toBeTruthy();
  });

  it("names the sound on its delete button", async () => {
    await renderWithTheme(<CustomSoundsScreen />);

    expect(
      screen.getByRole("button", {
        name: t("a11y.customSound.deleteSound", { name: SOUND.name }),
      })
    ).toBeTruthy();
  });

  it("writes the size in the reader's units", async () => {
    await renderWithTheme(<CustomSoundsScreen />);

    expect(screen.getByText(formatFileSizeLocale(SOUND.fileSize, t))).toBeTruthy();
  });

  // A Latin file name with punctuation reorders inside an Arabic row.
  it("isolates the file name from the row's direction", async () => {
    await renderWithTheme(<CustomSoundsScreen />);

    expect(
      screen.getByText(`${LTR_ISOLATE.OPEN}${SOUND.fileName}${LTR_ISOLATE.CLOSE}`)
    ).toBeTruthy();
  });
});
