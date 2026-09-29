import { Component, createRef } from "react";
import { AccessibilityInfo, Text, View } from "react-native";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { ReduceMotion } from "react-native-reanimated";

import {
  ACTIONSHEET_PART,
  Actionsheet,
  ActionsheetContent,
  ActionsheetTitle,
} from "@/components/ui/actionsheet";
import { useAppCovered } from "@/components/ui/actionsheet/cover";
import i18n from "@/localization/i18n";
import { BOTTOM_SHEET_PART, modalProps } from "@/test-helpers/bottomSheetMock";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

let mockReduced = false;
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => mockReduced }));

const TITLE = "Fajr";
const COVER = "cover";
const FOCUS = "focus";
const HEADER = "header";
// The open sheet hides its siblings from a reader, so tests look past that.
const hidden = { includeHiddenElements: true };

/** Whether the app behind is covered, as the root layout reads it. */
const CoverProbe = () => <Text testID={COVER}>{String(useAppCovered())}</Text>;

const opener = createRef<View>();

const Screen = ({ open, onClose = jest.fn() }: { open: boolean; onClose?: () => void }) => (
  <>
    <CoverProbe />
    <View ref={opener} accessible accessibilityRole="button" />
    <Actionsheet isOpen={open} onClose={onClose} finalFocusRef={opener}>
      <ActionsheetContent>
        <ActionsheetTitle>
          <Text>{TITLE}</Text>
        </ActionsheetTitle>
      </ActionsheetContent>
    </Actionsheet>
  </>
);

// jest's View mock hands a ref its component, props included.
const roleOf = (node: unknown) =>
  node instanceof Component && "accessibilityRole" in node.props
    ? node.props.accessibilityRole
    : undefined;

// Compared by identity: printing a rendered node walks the whole tree.
const focusEvent = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent");
const focusedRoles = () => focusEvent.mock.calls.map(([node, event]) => [roleOf(node), event]);
const lastFocusIsOpener = () => {
  const [node, event] = focusEvent.mock.lastCall ?? [];
  return node === opener.current && event === FOCUS;
};
const covered = () => screen.getByTestId(COVER, hidden).props.children;
const lastSheetProps = () => modalProps.mock.lastCall?.[0];

describe("Actionsheet accessibility", () => {
  beforeEach(() => {
    mockReduced = false;
    focusEvent.mockReset();
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

  it("moves screen-reader focus to the title once the sheet is up", async () => {
    await renderWithTheme(<Screen open />);

    expect(screen.getByRole(HEADER, { name: TITLE })).toBeOnTheScreen();
    expect(focusedRoles()).toEqual([[HEADER, FOCUS]]);
  });

  it("holds the app behind out of the reader's reach while open", async () => {
    await renderWithTheme(<Screen open />);

    expect(covered()).toBe(String(true));
  });

  it("returns focus to the opener once the app is uncovered", async () => {
    const coveredAtFocus: string[] = [];
    await renderWithTheme(<Screen open />);
    focusEvent.mockImplementation(() => coveredAtFocus.push(covered()));

    await screen.rerender(<Screen open={false} />);

    expect(lastFocusIsOpener()).toBe(true);
    expect(coveredAtFocus.at(-1)).toBe(String(false));
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
