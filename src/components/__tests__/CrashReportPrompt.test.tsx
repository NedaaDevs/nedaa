import { screen } from "@testing-library/react-native";

import CrashReportPrompt from "@/components/CrashReportPrompt";
import { BOTTOM_SHEET_PART } from "@/test-helpers/bottomSheetMock";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("react-native-safe-area-context", () =>
  jest.requireActual("@/test-helpers/safeAreaMock")
);
jest.mock("@/hooks/useIsOffline", () => ({ useIsOffline: () => false }));
// A report from the last launch that is still worth sending.
jest.mock("@/utils/crashHandler", () => ({
  readPendingReport: () => ({}),
  isPendingReportActionable: () => true,
  clearPendingReport: jest.fn(),
}));

describe("CrashReportPrompt", () => {
  // gorhom groups its content into one "Bottom Sheet" element unless told not to.
  it("lets a screen reader reach each part of the prompt", async () => {
    await renderWithTheme(<CrashReportPrompt />);

    const content = screen.getByTestId(BOTTOM_SHEET_PART.CONTENT);
    expect(content.props.accessible).toBeFalsy();
    expect(content.props.accessibilityLabel).toBeUndefined();
    expect(content.props.accessibilityRole).toBeUndefined();
  });
});
