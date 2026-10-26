import { Alert, Platform } from "react-native";
import { act, screen, userEvent } from "@testing-library/react-native";
import type { DocumentPickerAsset } from "expo-document-picker";

import AddCustomSoundModal from "@/components/AddCustomSoundModal";
import { PlatformType } from "@/enums/app";
import i18n from "@/localization/i18n";
import { renderWithTheme } from "@/test-helpers/theme";
import { CUSTOM_SOUND_KEY_PREFIX, type CustomSound } from "@/types/customSound";
import {
  addCustomSound,
  findDuplicateSound,
  pickAudioFile,
  validateAudioFile,
} from "@/utils/customSoundManager";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@/stores/customSounds", () => ({
  useCustomSoundsStore: () => ({ customSounds: [] }),
}));
// The real manager reaches the sound store's database at import.
jest.mock("@/utils/customSoundManager", () => ({
  formatFileSize: (bytes: number) => `${bytes} B`,
  pickAudioFile: jest.fn(),
  addCustomSound: jest.fn(),
  findDuplicateSound: jest.fn(() => null),
  validateAudioFile: jest.fn(() => ({ valid: true })),
}));

const PLATFORM = Platform.OS;
const FILE: DocumentPickerAsset = {
  name: "athan.mp3",
  uri: "file:///athan.mp3",
  size: 2048,
  lastModified: 0,
};
const SOUND: CustomSound = {
  id: `${CUSTOM_SOUND_KEY_PREFIX}1`,
  name: "athan",
  contentUri: FILE.uri,
  fileName: FILE.name,
  fileSize: 2048,
  fileIdentifier: `${FILE.uri}_2048`,
  availableFor: [],
  dateAdded: "2026-10-26T00:00:00.000Z",
};
const FAILURE = "The sound could not be stored";

const t = i18n.t.bind(i18n);

const renderModal = async () => {
  const props = { isOpen: true, onClose: jest.fn(), onSuccess: jest.fn() };
  await renderWithTheme(<AddCustomSoundModal {...props} />);
  return props;
};

const pick = (user: ReturnType<typeof userEvent.setup>) =>
  user.press(screen.getByRole("button", { name: t("a11y.customSound.pickFile") }));

const add = (user: ReturnType<typeof userEvent.setup>) =>
  user.press(screen.getByRole("button", { name: t("common.add") }));

describe("AddCustomSoundModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = PlatformType.ANDROID;
    jest.mocked(findDuplicateSound).mockReturnValue(null);
    jest.mocked(validateAudioFile).mockReturnValue({ valid: true });
    jest.mocked(pickAudioFile).mockResolvedValue(FILE);
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });
  afterEach(() => {
    Platform.OS = PLATFORM;
  });

  it("adds the picked file under its own name, then closes", async () => {
    const result = { success: true, sound: SOUND } as const;
    jest.mocked(addCustomSound).mockResolvedValue(result);
    const props = await renderModal();
    const user = userEvent.setup();

    await pick(user);
    await add(user);

    expect(addCustomSound).toHaveBeenCalledWith(FILE, SOUND.name, expect.any(Array), [], false);
    expect(props.onSuccess).toHaveBeenCalledWith(result);
    expect(props.onClose).toHaveBeenCalled();
  });

  it("says why an add failed and lets the user try again", async () => {
    jest.mocked(addCustomSound).mockRejectedValue(new Error(FAILURE));
    const props = await renderModal();
    const user = userEvent.setup();

    await pick(user);
    await add(user);

    expect(screen.getByText(FAILURE)).toBeTruthy();
    expect(props.onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: t("common.add") })).toBeEnabled();
  });

  it("warns about a duplicate pick after an earlier Add anyway", async () => {
    jest.mocked(findDuplicateSound).mockReturnValue(SOUND);
    await renderModal();
    const user = userEvent.setup();

    await pick(user);
    const buttons = jest.mocked(Alert.alert).mock.calls[0]?.[2] ?? [];
    const addAnyway = buttons.find(
      (button) => button.text === t("notification.customSound.addAnyway")
    );
    expect(addAnyway).toBeDefined();
    await act(async () => addAnyway?.onPress?.());
    await pick(user);

    expect(Alert.alert).toHaveBeenCalledTimes(2);
  });

  it("says why a pick failed", async () => {
    jest.mocked(pickAudioFile).mockRejectedValue(new Error(FAILURE));
    await renderModal();

    await pick(userEvent.setup());

    expect(screen.getByText(FAILURE)).toBeTruthy();
  });
});
