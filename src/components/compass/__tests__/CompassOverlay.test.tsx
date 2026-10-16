import React from "react";
import { render, screen } from "@testing-library/react-native";

import { CompassOverlay } from "@/components/compass/CompassOverlay";

jest.mock("moti", () => {
  const { View } = jest.requireActual("react-native");
  return { MotiView: View };
});
jest.mock("lucide-react-native", () => ({ Smartphone: "Smartphone" }));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/components/ui/icon", () => ({ Icon: () => null }));
jest.mock("@/components/ui/text", () => {
  const { Text } = jest.requireActual("react-native");
  return { Text };
});
jest.mock("@/components/ui/vstack", () => {
  const { View } = jest.requireActual("react-native");
  return { VStack: View };
});

const renderOverlay = (variant: "holdFlat" | "calibrate") =>
  render(<CompassOverlay variant={variant} reduceMotion />);

describe("CompassOverlay", () => {
  it("shows the hold-flat hint", async () => {
    await renderOverlay("holdFlat");
    expect(screen.getByText("compass.holdFlat")).toBeOnTheScreen();
    expect(screen.queryByText("compass.calibrationNote")).not.toBeOnTheScreen();
  });

  it("shows the calibrate title and figure-8 instruction", async () => {
    await renderOverlay("calibrate");
    expect(screen.getByText("compass.issue.sensor_uncalibrated.title")).toBeOnTheScreen();
    expect(screen.getByText("compass.calibrationNote")).toBeOnTheScreen();
  });
});
