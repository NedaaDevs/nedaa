import { AccessibilityInfo, Platform } from "react-native";
import { act, screen, userEvent, waitFor, within } from "@testing-library/react-native";

import AudioOnboarding from "@/components/athkar/AudioOnboarding";
import { TOAST_KIND } from "@/constants/Toast";
import { PlatformType } from "@/enums/app";
import i18n from "@/localization/i18n";
import { audioDownloadManager } from "@/services/athkar-audio-download";
import { reciterRegistry } from "@/services/athkar-reciter-registry";
import { useToastStore } from "@/stores/toast";
import {
  MANIFEST,
  PACK_ONE_FAILED,
  PACK_WHOLE,
  RECITER,
  type PackResult,
} from "@/test-helpers/athkarAudio";
import { later, never } from "@/test-helpers/promises";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@/services/athkar-reciter-registry", () => ({
  reciterRegistry: {
    fetchCatalog: jest.fn(),
    fetchManifest: jest.fn(),
    getLocalizedName: (name: Record<string, string>) => name.en,
  },
}));
jest.mock("@/services/athkar-audio-download", () => ({
  audioDownloadManager: { downloadPack: jest.fn(), retryFailed: jest.fn() },
}));
jest.mock("@/services/athkar-player", () => ({ athkarPlayer: { initialize: jest.fn() } }));
jest.mock("@/services/audio/previewPlayer", () => ({
  addPreviewListener: () => () => {},
  playPreview: jest.fn(),
  stopPreview: jest.fn(),
}));

const PLATFORM = Platform.OS;
const t = i18n.t.bind(i18n);
const COMPLETE = t("athkar.onboarding.download.complete");
const announce = jest.mocked(AccessibilityInfo.announceForAccessibility);
const downloadPack = jest.mocked(audioDownloadManager.downloadPack);

// Leaving the reciter step starts the chosen reciter's download.
const leaveReciterStep = async () => {
  await renderWithTheme(<AudioOnboarding isOpen onClose={jest.fn()} />);
  await screen.findByText(RECITER.name.en);
  await userEvent.press(screen.getByText(t("athkar.onboarding.next")));
};

// The parent closes the dialog when the dialog reports a close.
const skip = async () => {
  await userEvent.press(screen.getByText(t("athkar.onboarding.skip")));
  await screen.rerender(<AudioOnboarding isOpen={false} onClose={jest.fn()} />);
};

const reopen = async () => {
  await screen.rerender(<AudioOnboarding isOpen onClose={jest.fn()} />);
  await screen.findByText(RECITER.name.en);
};

describe("AudioOnboarding", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = PlatformType.IOS;
    useToastStore.setState({ toast: null });
    jest
      .mocked(reciterRegistry.fetchCatalog)
      .mockResolvedValue({ version: 1, reciters: [RECITER] });
    jest.mocked(reciterRegistry.fetchManifest).mockResolvedValue(MANIFEST);
  });
  afterEach(() => {
    Platform.OS = PLATFORM;
  });

  // The dialog draws over toasts, so the finished download is said instead.
  it("says the download is complete once every file arrives", async () => {
    downloadPack.mockResolvedValue(PACK_WHOLE);
    await leaveReciterStep();

    await waitFor(() => expect(announce).toHaveBeenCalledWith(COMPLETE));
  });

  it("does not say the download is complete when a file fails", async () => {
    downloadPack.mockResolvedValue(PACK_ONE_FAILED);
    await leaveReciterStep();

    await waitFor(() => expect(useToastStore.getState().toast?.kind).toBe(TOAST_KIND.WARNING));
    expect(announce).not.toHaveBeenCalledWith(COMPLETE);
  });

  // The dialog stays mounted between openings and renders once with old state.
  it("does not say an earlier opening's download again on a reopening", async () => {
    downloadPack.mockResolvedValue(PACK_WHOLE);
    await leaveReciterStep();
    await waitFor(() => expect(announce).toHaveBeenCalledWith(COMPLETE));

    await skip();
    await reopen();

    expect(announce.mock.calls.filter(([said]) => said === COMPLETE)).toHaveLength(1);
  });

  // A skipped dialog leaves its download to run on.
  it("does not say a download that ends after the dialog closes", async () => {
    const download = later<PackResult>();
    downloadPack.mockReturnValue(download.promise);
    await leaveReciterStep();

    await skip();
    await act(async () => download.release(PACK_WHOLE));
    await reopen();

    expect(announce).not.toHaveBeenCalledWith(COMPLETE);
  });

  it("groups the reciters as one named choice", async () => {
    await renderWithTheme(<AudioOnboarding isOpen onClose={jest.fn()} />);

    await screen.findByText(RECITER.name.en);
    const reciters = screen.getByLabelText(t("settings.athkarAudio.reciter"));
    expect(reciters).toHaveProp("accessibilityRole", "radiogroup");
    expect(within(reciters).getAllByRole("radio")).toHaveLength(1);
  });

  // The radio's name hides the line under it, so it says that line too.
  it("groups the playback modes and says what each one does", async () => {
    downloadPack.mockReturnValue(never<PackResult>());
    await leaveReciterStep();

    const modes = await screen.findByLabelText(t("athkar.onboarding.mode.title"));
    expect(modes).toHaveProp("accessibilityRole", "radiogroup");
    expect(
      within(modes).getByRole("radio", {
        name: t("a11y.join", {
          first: t("athkar.onboarding.mode.autopilot.title"),
          second: t("athkar.onboarding.mode.autopilot.description"),
        }),
        selected: true,
      })
    ).toBeTruthy();
  });
});
