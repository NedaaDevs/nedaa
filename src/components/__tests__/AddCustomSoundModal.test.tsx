import { Alert, Platform } from "react-native";
import { act, screen, userEvent } from "@testing-library/react-native";
import type { DocumentPickerAsset } from "expo-document-picker";

import AddCustomSoundModal from "@/components/AddCustomSoundModal";
import { CUSTOM_SOUND_ERROR, CUSTOM_SOUND_STATUS_ID } from "@/constants/CustomSound";
import { PlatformType } from "@/enums/app";
import i18n from "@/localization/i18n";
import { layOut } from "@/test-helpers/layout";
import { renderWithTheme } from "@/test-helpers/theme";
import {
  CUSTOM_SOUND_KEY_PREFIX,
  SUPPORTED_AUDIO_FORMATS,
  type CustomSound,
} from "@/types/customSound";
import {
  addCustomSound,
  findDuplicateSound,
  pickAudioFile,
  validateAudioFile,
} from "@/utils/customSoundManager";
import { formatFileSizeLocale } from "@/utils/number";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@/stores/customSounds", () => ({
  useCustomSoundsStore: () => ({ customSounds: [] }),
}));
// The real manager reaches the sound store's database at import.
jest.mock("@/utils/customSoundManager", () => ({
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

  it("says an add failed in the reader's words and lets the user try again", async () => {
    jest.mocked(addCustomSound).mockRejectedValue(new Error(FAILURE));
    const props = await renderModal();
    const user = userEvent.setup();

    await pick(user);
    await add(user);

    expect(screen.getByText(t("notification.customSound.addError"))).toBeTruthy();
    expect(screen.queryByText(FAILURE)).toBeNull();
    expect(props.onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: t("common.add") })).toBeEnabled();
  });

  it("keeps a failure code the manager returns off the screen", async () => {
    jest.mocked(addCustomSound).mockResolvedValue({ success: false, error: FAILURE });
    await renderModal();
    const user = userEvent.setup();

    await pick(user);
    await add(user);

    expect(screen.getByText(t("notification.customSound.addError"))).toBeTruthy();
    expect(screen.queryByText(FAILURE)).toBeNull();
  });

  it("refuses a file of another format at the pick, and names the formats", async () => {
    jest
      .mocked(validateAudioFile)
      .mockReturnValue({ valid: false, error: CUSTOM_SOUND_ERROR.UNSUPPORTED });
    await renderModal();

    await pick(userEvent.setup());

    expect(
      screen.getByText(
        t("notification.customSound.unsupportedFormat", { formats: SUPPORTED_AUDIO_FORMATS })
      )
    ).toBeTruthy();
    expect(screen.queryByText(FILE.name)).toBeNull();
  });

  it("reads the picked file and its size as the picker's value", async () => {
    await renderModal();

    await pick(userEvent.setup());

    const size = formatFileSizeLocale(FILE.size ?? 0, t);
    expect(screen.getByText(size)).toBeTruthy();
    expect(screen.getByRole("button", { name: t("a11y.customSound.pickFile") })).toHaveProp(
      "accessibilityValue",
      { text: `${FILE.name} ${size}` }
    );
  });

  it("says a failure on a live region mounted before it", async () => {
    jest.mocked(pickAudioFile).mockRejectedValue(new Error(FAILURE));
    await renderModal();
    const region = screen.getByTestId(CUSTOM_SOUND_STATUS_ID);
    await layOut(region);
    expect(region).toHaveProp("accessibilityLabel", "");

    await pick(userEvent.setup());

    expect(screen.getByTestId(CUSTOM_SOUND_STATUS_ID)).toBe(region);
    expect(region).toHaveProp("accessibilityLabel", t("notification.customSound.pickError"));
  });

  it("keeps the add button's name while the sound is stored", async () => {
    jest.mocked(addCustomSound).mockReturnValue(new Promise(() => {}));
    await renderModal();
    const user = userEvent.setup();

    await pick(user);
    await add(user);

    expect(screen.getByRole("button", { name: t("common.add") })).toBeDisabled();
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

  it("keeps the approval to add a duplicate when a later pick is cancelled", async () => {
    jest.mocked(findDuplicateSound).mockReturnValue(SOUND);
    jest.mocked(addCustomSound).mockResolvedValue({ success: true, sound: SOUND });
    await renderModal();
    const user = userEvent.setup();

    await pick(user);
    const addAnyway = jest
      .mocked(Alert.alert)
      .mock.calls[0][2]?.find(({ text }) => text === t("notification.customSound.addAnyway"));
    await act(async () => addAnyway?.onPress?.());
    jest.mocked(pickAudioFile).mockResolvedValue(null);
    await pick(user);
    await user.press(screen.getByRole("button", { name: t("common.add") }));

    expect(jest.mocked(addCustomSound).mock.calls[0][4]).toBe(true);
  });

  it("says a pick failed in the reader's words", async () => {
    jest.mocked(pickAudioFile).mockRejectedValue(new Error(FAILURE));
    await renderModal();

    await pick(userEvent.setup());

    expect(screen.getByText(t("notification.customSound.pickError"))).toBeTruthy();
    expect(screen.queryByText(FAILURE)).toBeNull();
  });
});
