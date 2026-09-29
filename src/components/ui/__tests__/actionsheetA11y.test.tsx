import { Text } from "react-native";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { ReduceMotion } from "react-native-reanimated";

import { ACTIONSHEET_PART, Actionsheet, ActionsheetContent } from "@/components/ui/actionsheet";
import { useAppCovered } from "@/components/ui/actionsheet/cover";
import i18n from "@/localization/i18n";
import { BOTTOM_SHEET_PART, modalProps } from "@/test-helpers/bottomSheetMock";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

let mockReduced = false;
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => mockReduced }));

const BODY = "Fajr";
const COVER = "cover";
// The open sheet hides its siblings from a reader, so tests look past that.
const hidden = { includeHiddenElements: true };

/** Whether the app behind is covered, as the root layout reads it. */
const CoverProbe = () => <Text testID={COVER}>{String(useAppCovered())}</Text>;

const Screen = ({ open, onClose = jest.fn() }: { open: boolean; onClose?: () => void }) => (
  <>
    <CoverProbe />
    <Actionsheet isOpen={open} onClose={onClose}>
      <ActionsheetContent>
        <Text>{BODY}</Text>
      </ActionsheetContent>
    </Actionsheet>
  </>
);

const covered = () => screen.getByTestId(COVER, hidden).props.children;
const lastSheetProps = () => modalProps.mock.lastCall?.[0];

describe("Actionsheet accessibility", () => {
  beforeEach(() => {
    mockReduced = false;
    modalProps.mockClear();
  });

  it("keeps VoiceOver inside the sheet while it is open", async () => {
    await renderWithTheme(<Screen open />);

    const layer = screen.getByTestId(ACTIONSHEET_PART.LAYER, hidden);
    expect(layer.props.accessibilityViewIsModal).toBe(true);
  });

  // gorhom groups its content into one "Bottom Sheet" element unless told not to.
  it("lets a screen reader reach each part of the content", async () => {
    await renderWithTheme(<Screen open />);

    const content = screen.getByTestId(BOTTOM_SHEET_PART.CONTENT, hidden);
    expect(content.props.accessible).toBeFalsy();
    expect(content.props.accessibilityLabel).toBeUndefined();
    expect(content.props.accessibilityRole).toBeUndefined();
  });

  it("holds the app behind out of the reader's reach while open", async () => {
    await renderWithTheme(<Screen open />);

    expect(covered()).toBe(String(true));
  });

  it("closes on the iOS escape gesture", async () => {
    const onClose = jest.fn();
    await renderWithTheme(<Screen open onClose={onClose} />);

    await act(() =>
      fireEvent(screen.getByTestId(ACTIONSHEET_PART.LAYER, hidden), "accessibilityEscape")
    );

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("names the backdrop in the app's language", async () => {
    await renderWithTheme(<Screen open />);

    const backdrop = screen.getByTestId(BOTTOM_SHEET_PART.BACKDROP);
    expect(backdrop.props.accessibilityLabel).toBe(i18n.t("common.close"));
  });

  it("slides when motion is allowed", async () => {
    await renderWithTheme(<Screen open />);

    expect(lastSheetProps()?.overrideReduceMotion).toBe(ReduceMotion.Never);
  });

  it("appears at once under Reduce Motion", async () => {
    mockReduced = true;
    await renderWithTheme(<Screen open />);

    expect(lastSheetProps()?.overrideReduceMotion).toBe(ReduceMotion.Always);
  });
});
