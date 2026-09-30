import { Component, createRef } from "react";
import { AccessibilityInfo, Text, View } from "react-native";
import { act, fireEvent, screen, within } from "@testing-library/react-native";
import { ReduceMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getTokenValue } from "tamagui";

import {
  ACTIONSHEET_PART,
  Actionsheet,
  ActionsheetContent,
  ActionsheetOverlay,
  ActionsheetTitle,
} from "@/components/ui/actionsheet";
import { useAppCovered, useSheetLayerUp } from "@/components/ui/actionsheet/cover";
import i18n from "@/localization/i18n";
import { BOTTOM_SHEET_PART, modalProps } from "@/test-helpers/bottomSheetMock";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: jest.fn(),
}));
// A Dynamic Island iPhone's top inset.
const INSETS = { top: 59, bottom: 34, left: 0, right: 0 };

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
    jest.mocked(useSafeAreaInsets).mockReturnValue(INSETS);
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

  // A sheet sized to its content stops short of the status bar.
  it("keeps a content-sized sheet clear of the status bar", async () => {
    await renderWithTheme(
      <Actionsheet isOpen fitContent>
        <ActionsheetContent />
      </Actionsheet>
    );

    expect(lastSheetProps()?.topInset).toBeGreaterThanOrEqual(
      INSETS.top + getTokenValue("$section", "space")
    );
  });

  // iOS hides every sibling of the modal layer, a toast at the root included.
  describe("overlay", () => {
    const OVERLAY = "overlay";
    const LAYER_UP = "layer-up";
    const LayerProbe = () => <Text testID={LAYER_UP}>{String(useSheetLayerUp())}</Text>;
    const Stacked = ({ second }: { second: boolean }) => (
      <ActionsheetOverlay value={<Text testID={OVERLAY} />}>
        <LayerProbe />
        <Actionsheet isOpen>
          <ActionsheetContent />
        </Actionsheet>
        <Actionsheet isOpen={second}>
          <ActionsheetContent />
        </Actionsheet>
      </ActionsheetOverlay>
    );
    const layers = () => screen.getAllByTestId(ACTIONSHEET_PART.LAYER, hidden);

    it("draws the overlay inside the top sheet's layer only", async () => {
      await renderWithTheme(<Stacked second />);

      const [under, top] = layers();
      expect(within(top).getAllByTestId(OVERLAY, hidden)).toHaveLength(1);
      expect(within(under).queryByTestId(OVERLAY, hidden)).toBeNull();
    });

    it("moves the overlay down once the top sheet closes", async () => {
      await renderWithTheme(<Stacked second />);

      await screen.rerender(<Stacked second={false} />);

      expect(layers()).toHaveLength(1);
      expect(within(layers()[0]).getAllByTestId(OVERLAY, hidden)).toHaveLength(1);
    });

    it("tells the app a layer is up, so it draws no overlay of its own", async () => {
      await renderWithTheme(<Stacked second={false} />);

      expect(screen.getByTestId(LAYER_UP, hidden).props.children).toBe(String(true));
    });
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
