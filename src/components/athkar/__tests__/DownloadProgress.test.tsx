import { screen } from "@testing-library/react-native";

import DownloadProgress from "@/components/athkar/DownloadProgress";
import i18n from "@/localization/i18n";
import { renderWithTheme } from "@/test-helpers/theme";

const t = i18n.t.bind(i18n);

describe("DownloadProgress", () => {
  it("names a first download as a download", async () => {
    await renderWithTheme(<DownloadProgress completed={3} total={10} />);

    expect(screen.getByText(t("athkar.audio.downloading"))).toBeTruthy();
    expect(screen.getByLabelText(t("a11y.athkar.downloading"))).toBeTruthy();
  });

  // The words over the bar and the bar's own name say the same thing.
  it("names a retry as a retry, over the bar and on it", async () => {
    await renderWithTheme(<DownloadProgress completed={1} total={2} retrying />);

    expect(screen.getByText(t("athkar.audio.retrying"))).toBeTruthy();
    expect(screen.getByLabelText(t("a11y.athkar.retrying"))).toBeTruthy();
    expect(screen.queryByLabelText(t("a11y.athkar.downloading"))).toBeNull();
  });
});
