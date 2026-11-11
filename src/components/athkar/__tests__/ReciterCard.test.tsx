import type { ComponentProps } from "react";
import { act, screen, userEvent } from "@testing-library/react-native";

import ReciterCard from "@/components/athkar/ReciterCard";
import { AppLocale } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useAppStore } from "@/stores/app";
import { RECITER } from "@/test-helpers/athkarAudio";
import { renderWithTheme } from "@/test-helpers/theme";
import { formatFileSize } from "@/utils/customSoundManager";
import { formatFileSizeLocale } from "@/utils/number";

const NAME = RECITER.name.en;
const SIZE = formatFileSize(RECITER.totalSize);

const t = i18n.t.bind(i18n);
const join = (...parts: string[]) =>
  parts.reduce((first, second) => t("a11y.join", { first, second }));

const renderCard = (
  selected: boolean,
  { onSelect = jest.fn(), ...props }: Partial<ComponentProps<typeof ReciterCard>> = {}
) =>
  renderWithTheme(
    <ReciterCard
      reciter={RECITER}
      selected={selected}
      onSelect={onSelect}
      onPlaySample={jest.fn()}
      {...props}
    />
  );

describe("ReciterCard", () => {
  // The card is still mounted here, so its re-render goes inside act.
  afterEach(() =>
    act(async () => {
      useAppStore.setState({ locale: AppLocale.EN });
      await i18n.changeLanguage(AppLocale.EN);
    })
  );

  // The screen reader says the radio state, so the name holds no state word.
  it("says the choice once, through the radio state", async () => {
    await renderCard(true);

    expect(screen.getByRole("radio", { name: join(NAME, SIZE), selected: true })).toBeTruthy();
  });

  // The radio's name hides the line under it, so it says that line too.
  it("says the pack size and that the pack is downloaded", async () => {
    await renderCard(false, { downloaded: true });

    expect(
      screen.getByRole("radio", { name: join(NAME, SIZE, t("athkar.audio.downloaded")) })
    ).toBeTruthy();
  });

  // The progress bar under the chosen card says the download.
  it("leaves the download to the progress bar", async () => {
    await renderCard(true, { downloaded: false, isDownloading: true });

    expect(screen.getByRole("radio", { name: join(NAME, SIZE), selected: true })).toBeTruthy();
  });

  it("says the size in the app's language", async () => {
    useAppStore.setState({ locale: AppLocale.AR });
    await i18n.changeLanguage(AppLocale.AR);
    const spokenSize = formatFileSizeLocale(RECITER.totalSize, t);
    expect(spokenSize).not.toBe(SIZE);

    await renderCard(false);

    expect(screen.getByRole("radio", { name: join(NAME, spokenSize) })).toBeTruthy();
  });

  it("chooses the reciter when the radio is pressed", async () => {
    const onSelect = jest.fn();
    await renderCard(false, { onSelect });

    await userEvent.press(screen.getByRole("radio", { name: join(NAME, SIZE), selected: false }));

    expect(onSelect).toHaveBeenCalledWith(RECITER.id);
  });

  // A list holds one sample button per reciter, so each says whose it is.
  it("names the sample button with its reciter", async () => {
    await renderCard(false);

    expect(
      screen.getByRole("button", { name: join(t("a11y.athkar.playSample"), NAME) })
    ).toBeTruthy();
  });

  it("names the stop button with its reciter while the sample plays", async () => {
    await renderCard(false, { isSamplePlaying: true });

    expect(
      screen.getByRole("button", { name: join(t("a11y.athkar.stopSample"), NAME) })
    ).toBeTruthy();
  });
});
