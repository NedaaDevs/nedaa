import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

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
    accessibilityRole,
    accessibilityLabel,
  }: {
    children: React.ReactNode;
    onPress?: () => void;
    disabled?: boolean;
    accessibilityRole?: "button";
    accessibilityLabel?: string;
  }) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}>
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

const renderSheet = (props: Partial<typeof baseProps> = {}) =>
  render(<CompassDetailsSheet {...baseProps} {...props} />);

describe("CompassDetailsSheet", () => {
  beforeEach(() => mockSheet.mockClear());

  it("opens as a sheet sized to its content", async () => {
    await renderSheet();

    expect(mockSheet).toHaveBeenLastCalledWith(
      expect.objectContaining({ isOpen: true, fitContent: true })
    );
  });

  // The sheet reports a swipe or backdrop dismissal; the screen owns the open state.
  it("tells the screen when the sheet is dismissed", async () => {
    const onOpenChange = jest.fn();
    await renderSheet({ onOpenChange });

    await act(() => mockSheet.mock.lastCall?.[0].onClose());

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders all detail rows", async () => {
    await renderSheet();
    for (const label of [
      "compass.details.heading",
      "compass.details.qibla",
      "compass.details.distance",
      "compass.details.sensorAccuracy",
      "compass.details.northReference",
      "compass.details.location",
    ]) {
      expect(screen.getByText(label)).toBeOnTheScreen();
    }
  });

  it("omits qibla rows without a qibla", async () => {
    await renderSheet({ qiblaText: null, distanceText: null, locationText: null });
    expect(screen.queryByText("compass.details.qibla")).not.toBeOnTheScreen();
    expect(screen.queryByText("compass.details.distance")).not.toBeOnTheScreen();
    expect(screen.queryByText("compass.details.location")).not.toBeOnTheScreen();
  });

  it("triggers a location refresh", async () => {
    const onRefreshLocation = jest.fn();
    await renderSheet({ onRefreshLocation });
    await fireEvent.press(screen.getByRole("button", { name: "compass.details.refreshLocation" }));
    expect(onRefreshLocation).toHaveBeenCalled();
  });
});
