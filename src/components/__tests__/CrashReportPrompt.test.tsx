import { screen, userEvent } from "@testing-library/react-native";

import CrashReportPrompt from "@/components/CrashReportPrompt";
import i18n from "@/localization/i18n";
import { gorhomStops } from "@/test-helpers/bottomSheetMock";
import { renderWithTheme } from "@/test-helpers/theme";
import { clearPendingReport } from "@/utils/crashHandler";

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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("adds no screen-reader stop of gorhom's own", async () => {
    await renderWithTheme(<CrashReportPrompt />);

    expect(gorhomStops()).toEqual([]);
  });

  it("closes from a backdrop named in the app's language", async () => {
    await renderWithTheme(<CrashReportPrompt />);

    await userEvent.press(screen.getByRole("button", { name: i18n.t("a11y.dismiss") }));

    expect(clearPendingReport).toHaveBeenCalledTimes(1);
  });
});
