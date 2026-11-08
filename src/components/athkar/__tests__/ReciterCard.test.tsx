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
  {
    onSelect = jest.fn(),
    downloaded,
    isDownloading,
  }: Partial<ComponentProps<typeof ReciterCard>> = {}
) =>
  renderWithTheme(
    <ReciterCard
      reciter={RECITER}
      selected={selected}
      downloaded={downloaded}
      isDownloading={isDownloading}
      onSelect={onSelect}
      onPlaySample={jest.fn()}
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

  it("keeps the sample button reachable on its own", async () => {
    await renderCard(false);

    expect(screen.getByRole("button", { name: i18n.t("a11y.athkar.playSample") })).toBeTruthy();
  });
});
