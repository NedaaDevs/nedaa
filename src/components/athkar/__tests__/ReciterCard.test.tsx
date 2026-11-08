import type { ComponentProps } from "react";
import { screen, userEvent } from "@testing-library/react-native";

import ReciterCard from "@/components/athkar/ReciterCard";
import i18n from "@/localization/i18n";
import { RECITER } from "@/test-helpers/athkarAudio";
import { renderWithTheme } from "@/test-helpers/theme";
import { formatFileSize } from "@/utils/customSoundManager";

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
  // The screen reader must hear a choice, its name and whether it is chosen.
  it("reads as a radio with the reciter's name and state", async () => {
    await renderCard(true);

    expect(
      screen.getByRole("radio", {
        name: join(t("a11y.athkar.reciterSelected", { name: NAME }), SIZE),
        selected: true,
      })
    ).toBeTruthy();
  });

  // The radio's name hides the line under it, so it says that line too.
  it("says the pack size and that the pack is downloaded", async () => {
    await renderCard(false, { downloaded: true });

    expect(
      screen.getByRole("radio", { name: join(NAME, SIZE, t("athkar.audio.downloaded")) })
    ).toBeTruthy();
  });

  // The spinning badge has no words of its own.
  it("says the download while the chosen pack downloads", async () => {
    await renderCard(true, { downloaded: false, isDownloading: true });

    expect(
      screen.getByRole("radio", {
        name: join(
          t("a11y.athkar.reciterSelected", { name: NAME }),
          SIZE,
          t("a11y.athkar.downloading")
        ),
      })
    ).toBeTruthy();
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
