import { Platform, Text } from "react-native";
import { usePathname } from "expo-router";
import { userEvent } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";

import { PlaybackRow } from "@/components/prayer-detail/PlaybackRow";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { PlatformType } from "@/enums/app";
import i18n from "@/localization/i18n";
import { useNotificationStore } from "@/stores/notification";
import { normalizeRoutePath } from "@/test-helpers/routeTree";
import { ThemeProvider } from "@/test-helpers/theme";

const PLATFORM = Platform.OS;
const TITLE = i18n.t("prayerDetail.playback.title");
const SECTION = i18n.t("prayerDetail.sections.playback");

const Pathname = () => <Text testID="pathname">{usePathname()}</Text>;

const renderRow = () =>
  renderRouter(
    {
      [BACK_DESTINATION.HOME.route]: () => (
        <>
          <PlaybackRow />
          <Pathname />
        </>
      ),
      [BACK_DESTINATION.SETTINGS_ATHAN_PLAYBACK.route]: () => <Pathname />,
    },
    {
      initialUrl: BACK_DESTINATION.HOME.href as string,
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    }
  );

const setPlayback = (fullAthanPlayback: boolean, fullIqamaPlayback: boolean) =>
  useNotificationStore.setState({ fullAthanPlayback, fullIqamaPlayback });

afterEach(() => {
  Platform.OS = PLATFORM;
});

describe("PlaybackRow on iOS", () => {
  // Full playback is an Android-only player; iOS has no such setting.
  it("renders nothing", async () => {
    Platform.OS = PlatformType.IOS;
    setPlayback(true, true);
    await renderRow();

    expect(screen.queryByRole("button", { name: new RegExp(TITLE) })).toBeNull();
    expect(screen.queryByText(i18n.t("prayerDetail.playback.scope"))).toBeNull();
    expect(screen.queryByRole("header", { name: SECTION })).toBeNull();
  });
});

describe("PlaybackRow on Android", () => {
  beforeEach(() => {
    Platform.OS = PlatformType.ANDROID;
  });

  it.each([
    [true, true, "prayerDetail.playback.summary.both"],
    [true, false, "prayerDetail.playback.summary.athan"],
    [false, true, "prayerDetail.playback.summary.iqama"],
    [false, false, "prayerDetail.playback.summary.off"],
  ] as const)("reads athan=%s iqama=%s as its summary", async (athan, iqama, summaryKey) => {
    setPlayback(athan, iqama);
    await renderRow();

    expect(screen.getByRole("button", { name: `${TITLE}, ${i18n.t(summaryKey)}` })).toBeTruthy();
  });

  // The setting is global; a row inside one prayer's sheet must say so.
  it("says it applies to all prayers", async () => {
    setPlayback(false, false);
    await renderRow();

    expect(screen.getByText(i18n.t("prayerDetail.playback.scope"))).toBeTruthy();
  });

  // Its own header keeps it from reading as part of the section above.
  it("heads itself as a section of its own", async () => {
    setPlayback(false, false);
    await renderRow();

    expect(screen.getByRole("header", { name: SECTION })).toBeTruthy();
  });

  it("holds no switches", async () => {
    setPlayback(true, false);
    await renderRow();

    expect(screen.queryAllByRole("switch")).toHaveLength(0);
  });

  it("names the playback settings screen as where it goes, and opens it", async () => {
    setPlayback(true, true);
    await renderRow();

    const row = screen.getByRole("button", { name: new RegExp(TITLE) });
    expect(row.props.accessibilityHint).toBe(
      i18n.t("a11y.prayerDetail.playback.hint", {
        name: i18n.t(BACK_DESTINATION.SETTINGS_ATHAN_PLAYBACK.title),
      })
    );

    await userEvent.press(row);

    expect(screen.getByTestId("pathname")).toHaveTextContent(
      normalizeRoutePath(BACK_DESTINATION.SETTINGS_ATHAN_PLAYBACK.href)
    );
  });
});
