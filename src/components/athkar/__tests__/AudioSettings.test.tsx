import { Alert } from "react-native";
import { screen, userEvent, waitFor, within } from "@testing-library/react-native";

import AudioSettings from "@/components/athkar/AudioSettings";
import { PLAYBACK_MODE } from "@/constants/AthkarAudio";
import { TOAST_KIND } from "@/constants/Toast";
import i18n from "@/localization/i18n";
import { audioDownloadManager } from "@/services/athkar-audio-download";
import { AthkarDB } from "@/services/athkar-db";
import { reciterRegistry } from "@/services/athkar-reciter-registry";
import { useAthkarAudioStore } from "@/stores/athkar-audio";
import { useToastStore } from "@/stores/toast";
import {
  MANIFEST,
  PACK_ONE_FAILED,
  PACK_WHOLE,
  RECITER,
  type PackResult,
} from "@/test-helpers/athkarAudio";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@/services/athkar-reciter-registry", () => ({
  reciterRegistry: {
    fetchCatalog: jest.fn(),
    fetchManifest: jest.fn(),
    getLocalizedName: (name: Record<string, string>) => name.en,
  },
}));
jest.mock("@/services/athkar-audio-download", () => ({
  audioDownloadManager: {
    getStorageBreakdown: jest.fn(),
    downloadPack: jest.fn(),
    retryFailed: jest.fn(),
    deleteReciterPack: jest.fn(),
  },
}));
jest.mock("@/services/athkar-db", () => ({ AthkarDB: { getAudioStorageUsed: jest.fn() } }));
jest.mock("@/services/athkar-player", () => ({ athkarPlayer: { initialize: jest.fn() } }));
jest.mock("@/services/audio/previewPlayer", () => ({
  addPreviewListener: () => () => {},
  playPreview: jest.fn(),
  stopPreview: jest.fn(),
}));
jest.mock("@/components/athkar/AudioOnboarding", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/ReportProblemModal", () => ({ __esModule: true, default: () => null }));

const t = i18n.t.bind(i18n);
const NAME = RECITER.name.en;
const DELETE = t("a11y.join", { first: t("common.delete"), second: NAME });
const ON_DEVICE = [{ reciterId: RECITER.id, size: RECITER.totalSize }];

// Choosing a reciter whose pack is not on the device downloads it.
const downloadFirstPack = async (result: PackResult) => {
  jest.mocked(audioDownloadManager.downloadPack).mockResolvedValue(result);
  await renderWithTheme(<AudioSettings />);
  await userEvent.press(await screen.findByText(NAME));
};

describe("AudioSettings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAthkarAudioStore.setState({ selectedReciterId: null });
    useToastStore.setState({ toast: null });
    jest
      .mocked(reciterRegistry.fetchCatalog)
      .mockResolvedValue({ version: 1, reciters: [RECITER] });
    jest.mocked(reciterRegistry.fetchManifest).mockResolvedValue(MANIFEST);
    jest.mocked(audioDownloadManager.getStorageBreakdown).mockResolvedValue([]);
    jest.mocked(AthkarDB.getAudioStorageUsed).mockResolvedValue(0);
  });

  // A retry that ends whole shows this toast; a first download ends the same.
  it("shows a success toast once every file of the first download arrives", async () => {
    await downloadFirstPack(PACK_WHOLE);

    await waitFor(() =>
      expect(useToastStore.getState().toast).toMatchObject({
        kind: TOAST_KIND.SUCCESS,
        message: t("athkar.audio.downloadRetrySuccess"),
      })
    );
  });

  it("keeps the failure toast when a file of the first download fails", async () => {
    await downloadFirstPack(PACK_ONE_FAILED);

    await waitFor(() => expect(audioDownloadManager.getStorageBreakdown).toHaveBeenCalledTimes(2));
    expect(useToastStore.getState().toast?.kind).toBe(TOAST_KIND.WARNING);
  });

  it("groups the reciters as one named choice", async () => {
    await renderWithTheme(<AudioSettings />);

    await screen.findByText(NAME);
    const reciters = screen.getByLabelText(t("settings.athkarAudio.reciter"));
    expect(reciters).toHaveProp("accessibilityRole", "radiogroup");
    expect(within(reciters).getAllByRole("radio")).toHaveLength(1);
  });

  // The radio's name hides the line under it, so it says that line too.
  it("groups the playback modes and says what each one does", async () => {
    useAthkarAudioStore.setState({ playbackMode: PLAYBACK_MODE.OFF });
    await renderWithTheme(<AudioSettings />);

    const modes = screen.getByLabelText(t("settings.athkarAudio.playbackMode"));
    expect(modes).toHaveProp("accessibilityRole", "radiogroup");
    expect(
      within(modes).getByRole("radio", {
        name: t("a11y.join", {
          first: t("settings.athkarAudio.mode.off"),
          second: t("settings.athkarAudio.mode.offDesc"),
        }),
        selected: true,
      })
    ).toBeTruthy();
  });

  // The storage list holds one delete button per reciter.
  it("names each delete button with its reciter", async () => {
    jest.mocked(audioDownloadManager.getStorageBreakdown).mockResolvedValue(ON_DEVICE);
    await renderWithTheme(<AudioSettings />);

    expect(await screen.findByRole("button", { name: DELETE })).toBeTruthy();
  });

  it("names the reciter in the delete confirmation", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    jest.mocked(audioDownloadManager.getStorageBreakdown).mockResolvedValue(ON_DEVICE);
    await renderWithTheme(<AudioSettings />);

    await userEvent.press(await screen.findByRole("button", { name: DELETE }));

    expect(alert).toHaveBeenCalledWith(
      t("settings.athkarAudio.deleteConfirm.title"),
      t("settings.athkarAudio.deleteConfirm.reciterMessage", { name: NAME }),
      expect.any(Array)
    );
  });
});
