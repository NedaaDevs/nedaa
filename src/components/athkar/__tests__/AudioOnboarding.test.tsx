import { AccessibilityInfo, Platform } from "react-native";
import { act, screen, userEvent, waitFor, within } from "@testing-library/react-native";

import AudioOnboarding from "@/components/athkar/AudioOnboarding";
import { MessageToast } from "@/components/feedback/MessageToast";
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
import type { ReciterManifest } from "@/types/athkar-audio";

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
const RETRY = t("athkar.audio.retry");
const announce = jest.mocked(AccessibilityInfo.announceForAccessibility);
const downloadPack = jest.mocked(audioDownloadManager.downloadPack);
const retryFailed = jest.mocked(audioDownloadManager.retryFailed);
const fetchManifest = jest.mocked(reciterRegistry.fetchManifest);

/** The reciter's pack cut to its first file. */
const ONE_FILE: ReciterManifest = {
  ...MANIFEST,
  files: Object.fromEntries(Object.entries(MANIFEST.files).slice(0, 1)),
};

type Report = NonNullable<Parameters<typeof audioDownloadManager.downloadPack>[2]>;
type Run = { report: Report; end: (result: PackResult) => void };

// Each download and retry runs until the test ends it, in call order.
const runs = () => {
  const started: Run[] = [];
  const start = (onProgress?: Report) => {
    const { promise, release } = later<PackResult>();
    started.push({ report: (completed, total) => onProgress?.(completed, total), end: release });
    return promise;
  };
  downloadPack.mockImplementation((_id, _manifest, onProgress) => start(onProgress));
  retryFailed.mockImplementation((_id, _manifest, _ids, onProgress) => start(onProgress));
  return started;
};

const next = () => userEvent.press(screen.getByText(t("athkar.onboarding.next")));
const progress = () => screen.getByLabelText(t("a11y.athkar.downloading"));

// Leaving the reciter step starts the chosen reciter's download.
const leaveReciterStep = async () => {
  await renderWithTheme(<AudioOnboarding isOpen onClose={jest.fn()} />);
  await screen.findByText(RECITER.name.en);
  await next();
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
    // clearAllMocks keeps implementations; each test stubs its own downloads.
    downloadPack.mockReset();
    retryFailed.mockReset();
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

  // The toast outlives the dialog.
  it("warns of the failed files when a download ends after the dialog closes", async () => {
    const download = later<PackResult>();
    downloadPack.mockReturnValue(download.promise);
    await leaveReciterStep();

    await skip();
    await act(async () => download.release(PACK_ONE_FAILED));

    expect(useToastStore.getState().toast).toMatchObject({
      kind: TOAST_KIND.WARNING,
      message: t("athkar.audio.downloadFailed", { count: PACK_ONE_FAILED.failed }),
    });
  });

  // A skip leaves a download running, and the reopened dialog starts another.
  describe("with an earlier opening's download still running", () => {
    const reopenAndDownload = async () => {
      const started = runs();
      await leaveReciterStep();
      await skip();
      await reopen();
      await next();
      await next();
      return started;
    };

    it("shows the latest download's progress", async () => {
      const [earlier, latest] = await reopenAndDownload();
      await act(async () => latest.report(1, 2));
      await act(async () => earlier.report(2, 2));

      expect(progress()).toHaveAccessibilityValue({ now: 50 });
    });

    it("leaves the result to the latest download", async () => {
      const [earlier, latest] = await reopenAndDownload();
      await act(async () => latest.report(2, 2));
      await act(async () => earlier.end(PACK_ONE_FAILED));
      expect(screen.queryByText(RETRY, { exact: false })).not.toBeOnTheScreen();

      await act(async () => latest.end(PACK_WHOLE));
      expect(screen.getByText(COMPLETE)).toBeOnTheScreen();
    });

    it("says only the latest download's completion", async () => {
      const [earlier, latest] = await reopenAndDownload();
      await act(async () => earlier.end(PACK_WHOLE));
      expect(announce).not.toHaveBeenCalledWith(COMPLETE);

      await act(async () => latest.end(PACK_WHOLE));
      expect(announce).toHaveBeenCalledWith(COMPLETE);
    });

    it("keeps the latest pack's size when an earlier manifest arrives", async () => {
      const manifest = later<ReciterManifest | null>();
      fetchManifest.mockReturnValueOnce(manifest.promise);
      const [latest] = await reopenAndDownload();
      await act(async () => latest.report(1, 2));
      await act(async () => manifest.release(ONE_FILE));

      expect(progress()).toHaveAccessibilityValue({ now: 50 });
    });

    it("shows no completion when an earlier manifest fails to load", async () => {
      const manifest = later<ReciterManifest | null>();
      fetchManifest.mockReturnValueOnce(manifest.promise);
      const [latest] = await reopenAndDownload();
      await act(async () => latest.report(2, 2));
      await act(async () => manifest.release(null));

      expect(screen.queryByText(COMPLETE)).not.toBeOnTheScreen();
    });
  });

  // A retry, like a download, runs on after a skip.
  describe("with an earlier opening's retry still running", () => {
    // The first download fails a file, and a skip leaves its retry running.
    const retryThenSkip = async () => {
      const started = runs();
      await leaveReciterStep();
      await next();
      await act(async () => started[0].end(PACK_ONE_FAILED));
      await userEvent.press(screen.getByText(RETRY, { exact: false }));
      await skip();
      return started;
    };

    const retryThenReopen = async () => {
      const started = await retryThenSkip();
      await reopen();
      await next();
      await next();
      const [, retry, latest] = started;
      return { retry, latest };
    };

    it("shows the latest download's progress", async () => {
      const { retry, latest } = await retryThenReopen();
      await act(async () => latest.report(2, 2));
      await act(async () => retry.report(1, 1));

      expect(progress()).toHaveAccessibilityValue({ now: 100 });
    });

    // The first download's warning leaves before the retry ends.
    it.each([
      {
        result: PACK_WHOLE,
        toast: { kind: TOAST_KIND.SUCCESS, message: t("athkar.audio.downloadRetrySuccess") },
      },
      {
        result: PACK_ONE_FAILED,
        toast: {
          kind: TOAST_KIND.WARNING,
          message: t("athkar.audio.downloadFailed", { count: PACK_ONE_FAILED.failed }),
        },
      },
    ])(
      "shows a $toast.kind toast when a retry ends after the dialog closes",
      async ({ result, toast }) => {
        const [, retry] = await retryThenSkip();
        await act(async () => MessageToast.hide());
        await act(async () => retry.end(result));

        expect(useToastStore.getState().toast).toMatchObject(toast);
      }
    );

    it("leaves the result to the latest download", async () => {
      const { retry, latest } = await retryThenReopen();
      await act(async () => retry.end(PACK_ONE_FAILED));
      await act(async () => latest.report(2, 2));
      await act(async () => latest.end(PACK_WHOLE));

      expect(screen.getByText(COMPLETE)).toBeOnTheScreen();
    });
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
