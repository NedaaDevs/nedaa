import { screen } from "@testing-library/react-native";
import { getTokenValue } from "tamagui";

import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { NEDAA_LIGHT } from "@/constants/Palette";
import { styleOf } from "@/test-helpers/text";
import { renderWithTheme } from "@/test-helpers/theme";

const ACTIONS = ["error", "warning", "success", "info", "muted"] as const;

const renderBadge = (props: Parameters<typeof Badge>[0] = {}) =>
  renderWithTheme(
    <>
      <Badge testID="badge" {...props}>
        <Badge.Text>On</Badge.Text>
      </Badge>
      <Text size="sm" fontWeight="600">
        reference
      </Text>
    </>
  );

describe("Badge", () => {
  // A badge is a pill: a tint carries it, never a drawn line.
  it.each(ACTIONS)("draws no border and rounds as a pill (%s)", async (action) => {
    await renderBadge({ action });
    const frame = styleOf(screen.getByTestId("badge"));

    expect(frame.borderTopWidth ?? 0).toBe(0);
    expect(frame.borderTopColor).toBeUndefined();
    expect(frame.borderTopLeftRadius).toBe(getTokenValue("$pill", "radius"));
  });

  it("sets its text at 12/600, as written", async () => {
    await renderBadge();

    expect(screen.getByText("On")).toHaveStyle({
      fontSize: 12,
      fontFamily: styleOf(screen.getByText("reference")).fontFamily,
    });
    expect(styleOf(screen.getByText("On")).textTransform).toBeUndefined();
  });

  it.each([
    ["muted", NEDAA_LIGHT.quietTint.hex, NEDAA_LIGHT.muted.hex],
    ["info", NEDAA_LIGHT.accentTint.hex, NEDAA_LIGHT.accentText.hex],
  ] as const)("tints the %s badge like the pill", async (action, fill, ink) => {
    await renderBadge({ action });

    expect(screen.getByTestId("badge")).toHaveStyle({ backgroundColor: fill });
    expect(screen.getByText("On")).toHaveStyle({ color: ink });
  });
});
