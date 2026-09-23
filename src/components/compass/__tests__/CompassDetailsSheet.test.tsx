import React from "react";
import renderer, { act } from "react-test-renderer";

import { CompassDetailsSheet } from "@/components/compass/CompassDetailsSheet";

jest.mock("lucide-react-native", () => ({ RefreshCw: "RefreshCw" }));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
// gorhom's modal needs reanimated, which cannot load under jest.
const mockSheet = jest.fn();
jest.mock("@/components/ui/actionsheet", () => {
  const { View } = jest.requireActual("react-native");
  return {
    Actionsheet: (props: { children: React.ReactNode }) => {
      mockSheet(props);
      return <View>{props.children}</View>;
    },
    ActionsheetContent: View,
  };
});
jest.mock("@/components/ui/button", () => {
  const { Pressable, Text, View } = jest.requireActual("react-native");
  const Button = ({
    children,
    onPress,
    disabled,
  }: {
    children: React.ReactNode;
    onPress?: () => void;
    disabled?: boolean;
  }) => (
    <Pressable onPress={onPress} disabled={disabled}>
      {children}
    </Pressable>
  );
  Button.Spinner = View;
  Button.Icon = View;
  Button.Text = Text;
  return { Button };
});
jest.mock("@/components/ui/hstack", () => {
  const { View } = jest.requireActual("react-native");
  return { HStack: View };
});
jest.mock("@/components/ui/text", () => {
  const { Text } = jest.requireActual("react-native");
  return { Text };
});
jest.mock("@/components/ui/vstack", () => {
  const { View } = jest.requireActual("react-native");
  return { VStack: View };
});

const baseProps = {
  open: true,
  onOpenChange: jest.fn(),
  headingText: "123°",
  qiblaText: "245°" as string | null,
  distanceText: "4,523 km" as string | null,
  sensorAccuracyText: "±5°",
  sensorReliabilityText: "good",
  northReferenceText: "true north",
  locationText: "±12 m" as string | null,
  isRefreshing: false,
  canRefreshLocation: true,
  onRefreshLocation: jest.fn(),
};

const renderSheet = (props: Partial<typeof baseProps> = {}) => {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<CompassDetailsSheet {...baseProps} {...props} />);
  });
  return tree;
};

const hasText = (tree: renderer.ReactTestRenderer, text: string) =>
  tree.root.findAll((node) => node.props.children === text).length > 0;

describe("CompassDetailsSheet", () => {
  beforeEach(() => mockSheet.mockClear());

  it("opens as a sheet sized to its content", () => {
    renderSheet();

    expect(mockSheet).toHaveBeenLastCalledWith(
      expect.objectContaining({ isOpen: true, fitContent: true })
    );
  });

  // The sheet reports a swipe or backdrop dismissal; the screen owns the open state.
  it("tells the screen when the sheet is dismissed", () => {
    const onOpenChange = jest.fn();
    renderSheet({ onOpenChange });

    act(() => mockSheet.mock.lastCall?.[0].onClose());

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders all detail rows", () => {
    const tree = renderSheet();
    for (const label of [
      "compass.details.heading",
      "compass.details.qibla",
      "compass.details.distance",
      "compass.details.sensorAccuracy",
      "compass.details.northReference",
      "compass.details.location",
    ]) {
      expect(hasText(tree, label)).toBe(true);
    }
    act(() => tree.unmount());
  });

  it("omits qibla rows without a qibla", () => {
    const tree = renderSheet({ qiblaText: null, distanceText: null, locationText: null });
    expect(hasText(tree, "compass.details.qibla")).toBe(false);
    expect(hasText(tree, "compass.details.distance")).toBe(false);
    expect(hasText(tree, "compass.details.location")).toBe(false);
    act(() => tree.unmount());
  });

  it("triggers a location refresh", () => {
    const onRefreshLocation = jest.fn();
    const tree = renderSheet({ onRefreshLocation });
    const button = tree.root.findAllByProps({ accessibilityRole: "button" })[0];
    act(() => button.props.onPress());
    expect(onRefreshLocation).toHaveBeenCalled();
    act(() => tree.unmount());
  });
});
