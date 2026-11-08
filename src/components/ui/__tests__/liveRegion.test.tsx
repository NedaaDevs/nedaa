import { AccessibilityInfo, Platform } from "react-native";
import { screen } from "@testing-library/react-native";

import { LiveRegion, SpokenStatus } from "@/components/ui/live-region";
import { PlatformType } from "@/enums/app";
import { layOut } from "@/test-helpers/layout";
import { renderWithTheme } from "@/test-helpers/theme";

const PLATFORM = Platform.OS;
const REGION = "live-region";
const MESSAGE = "Applying changes…";
const NEXT = "Scheduling notifications…";

const region = () => screen.getByTestId(REGION);

describe("LiveRegion", () => {
  // A label set before the native view is attached sends Android nothing.
  it("holds a message it mounts with until its view is laid out", async () => {
    await renderWithTheme(<LiveRegion testID={REGION} message={MESSAGE} />);
    const mounted = region();
    expect(mounted).toHaveProp("accessibilityLabel", "");
    expect(mounted).toHaveProp("accessible", false);

    await layOut(mounted);

    expect(region()).toBe(mounted);
    expect(mounted).toHaveProp("accessibilityLabel", MESSAGE);
    expect(mounted).toHaveProp("accessible", true);
  });

  it("says each later message on the same view", async () => {
    await renderWithTheme(<LiveRegion testID={REGION} message={null} />);
    const mounted = region();
    await layOut(mounted);
    expect(mounted).toHaveProp("accessibilityLabel", "");

    await screen.rerender(<LiveRegion testID={REGION} message={NEXT} />);

    expect(region()).toBe(mounted);
    expect(mounted).toHaveProp("accessibilityLabel", NEXT);
    expect(mounted).toHaveProp("accessibilityLiveRegion", "polite");
    expect(mounted).toHaveProp("importantForAccessibility", "yes");
  });
});

describe("SpokenStatus", () => {
  const announce = jest.mocked(AccessibilityInfo.announceForAccessibility);

  beforeEach(() => announce.mockClear());
  afterEach(() => {
    Platform.OS = PLATFORM;
  });

  // iOS has no live regions, so the message is announced and nothing is drawn.
  it("announces each message on iOS and draws nothing", async () => {
    Platform.OS = PlatformType.IOS;
    await renderWithTheme(<SpokenStatus testID={REGION} message={null} />);
    expect(announce).not.toHaveBeenCalled();

    await screen.rerender(<SpokenStatus testID={REGION} message={MESSAGE} />);

    expect(announce).toHaveBeenCalledWith(MESSAGE);
    expect(screen.queryByTestId(REGION)).toBeNull();
  });

  it("says each message through a live region on Android", async () => {
    Platform.OS = PlatformType.ANDROID;
    await renderWithTheme(<SpokenStatus testID={REGION} message={null} />);
    const mounted = region();
    await layOut(mounted);

    await screen.rerender(<SpokenStatus testID={REGION} message={MESSAGE} />);

    expect(region()).toBe(mounted);
    expect(mounted).toHaveProp("accessibilityLabel", MESSAGE);
    expect(mounted).toHaveProp("accessibilityLiveRegion", "polite");
    expect(announce).not.toHaveBeenCalled();
  });
});
