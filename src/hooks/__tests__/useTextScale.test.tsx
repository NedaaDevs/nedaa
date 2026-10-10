import { render, screen } from "@testing-library/react-native";

import { Text } from "@/components/ui/text";
import { TEXT_SIZE_MULTIPLIERS } from "@/constants/TextSize";
import { TextSize } from "@/enums/app";
import { TextScaleContext, useTextScale } from "@/hooks/useTextScale";
import { usePreferencesStore } from "@/stores/preferences";
import { ThemeProvider } from "@/test-helpers/theme";
import { fontSizeOf, styleOf } from "@/test-helpers/text";

const SCALE = "scale";

const Probe = () => {
  const scale = useTextScale();
  return <Text testID={SCALE}>{String(scale)}</Text>;
};

const scaleRead = () => Number(screen.getByTestId(SCALE).props.children);

describe("useTextScale", () => {
  beforeEach(() => usePreferencesStore.setState({ textSize: TextSize.LARGE }));

  it("reads the stored preset outside a context", async () => {
    await render(<Probe />, { wrapper: ThemeProvider });

    expect(scaleRead()).toBe(TEXT_SIZE_MULTIPLIERS[TextSize.LARGE]);
  });

  it("reads the context's scale in place of the preset", async () => {
    await render(
      <TextScaleContext value={TEXT_SIZE_MULTIPLIERS[TextSize.MAX]}>
        <Probe />
      </TextScaleContext>,
      { wrapper: ThemeProvider }
    );

    expect(scaleRead()).toBe(TEXT_SIZE_MULTIPLIERS[TextSize.MAX]);
  });

  it("lets the nearest context win, so a pinned subtree ignores an outer one", async () => {
    await render(
      <TextScaleContext value={TEXT_SIZE_MULTIPLIERS[TextSize.MAX]}>
        <TextScaleContext value={TEXT_SIZE_MULTIPLIERS[TextSize.DEFAULT]}>
          <Text testID="pinned" size="md">
            pinned
          </Text>
        </TextScaleContext>
        <Text testID="scaled" size="md">
          scaled
        </Text>
      </TextScaleContext>,
      { wrapper: ThemeProvider }
    );

    expect(styleOf(screen.getByTestId("pinned")).fontSize).toBe(fontSizeOf("md"));
    expect(styleOf(screen.getByTestId("scaled")).fontSize).toBe(
      fontSizeOf("md") * TEXT_SIZE_MULTIPLIERS[TextSize.MAX]
    );
  });
});
