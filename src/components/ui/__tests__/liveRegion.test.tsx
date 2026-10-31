import { screen } from "@testing-library/react-native";

import { LiveRegion } from "@/components/ui/live-region";
import { layOut } from "@/test-helpers/layout";
import { renderWithTheme } from "@/test-helpers/theme";

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
