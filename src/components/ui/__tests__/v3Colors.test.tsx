import { Text } from "react-native";
import { screen } from "@testing-library/react-native";

import config from "../../../../tamagui.config";
import { Actionsheet } from "@/components/ui/actionsheet";
import { Switch } from "@/components/ui/switch";
import { modalProps } from "@/test-helpers/bottomSheetMock";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const LIGHT = config.themes.light;

const switchNow = async (value: boolean) => {
  await renderWithTheme(<Switch value={value} />);
  return screen.getByRole("switch").props;
};

// A V3 screen reads as one piece only if its sheet and switch do too.
describe("V3 colours in shared primitives", () => {
  it("draws a sheet on the raised surface with a handle in the ink's tint", async () => {
    await renderWithTheme(
      <Actionsheet isOpen onClose={jest.fn()}>
        <Text>body</Text>
      </Actionsheet>
    );
    const props = modalProps.mock.lastCall?.[0];

    expect(props?.backgroundStyle?.backgroundColor).toBe(LIGHT.raised.val);
    expect(props?.handleIndicatorStyle?.backgroundColor).toBe(LIGHT.handle.val);
  });

  it("fills a switch with the accent while on", async () => {
    const props = await switchNow(true);

    expect(props.onTintColor).toBe(LIGHT.accent.val);
    expect(props.thumbTintColor).toBe(LIGHT.thumb.val);
  });

  it("tints an off switch's track with the ink", async () => {
    const props = await switchNow(false);

    expect(props.tintColor).toBe(LIGHT.track.val);
    expect(props.thumbTintColor).toBe(LIGHT.thumb.val);
  });
});
