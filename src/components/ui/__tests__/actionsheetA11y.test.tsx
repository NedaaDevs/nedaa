import { Component, createRef } from "react";
import { AccessibilityInfo, StyleSheet, Text, View, type ViewInstance } from "react-native";
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
  CLOSED_INDEX,
  useActionsheetOpen,
} from "@/components/ui/actionsheet";
import { useAppCovered, useSheetLayerUp } from "@/components/ui/actionsheet/cover";
import { NEDAA_LIGHT } from "@/constants/Palette";
import i18n from "@/localization/i18n";
import { gorhomStops, modalProps, moveSheet } from "@/test-helpers/bottomSheetMock";
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

const opener = createRef<ViewInstance>();

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

  it("adds no screen-reader stop of gorhom's own", async () => {
    await renderWithTheme(<Screen open />);

    expect(gorhomStops()).toEqual([]);
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

  it("names the scrim in the app's language", async () => {
    await renderWithTheme(<Screen open />);

    const backdrop = screen.getByTestId(ACTIONSHEET_PART.SCRIM);
    expect(backdrop.props.accessibilityLabel).toBe(i18n.t("a11y.dismiss"));
  });

  it("tints the scrim navy, at the strength its colour carries", async () => {
    await renderWithTheme(<Screen open />);

    expect(screen.getByTestId(ACTIONSHEET_PART.SCRIM)).toHaveStyle({
      backgroundColor: NEDAA_LIGHT.scrim.hex,
      opacity: 1,
    });
  });

  // A sheet sized to its content stops short of the status bar.
  it("keeps a content-sized sheet clear of the status bar", async () => {
    await renderWithTheme(
      <Actionsheet isOpen fitContent>
        <ActionsheetContent />
      </Actionsheet>
    );

    expect(lastSheetProps()?.topInset).toBeGreaterThan(INSETS.top);
  });

  describe("content bottom padding", () => {
    /** The padding under the content's last child. */
    const bottomPadding = () =>
      StyleSheet.flatten(screen.getByTestId(ACTIONSHEET_PART.BODY, hidden).props.style);
    const renderContent = async () =>
      renderWithTheme(
        <Actionsheet isOpen fitContent>
          <ActionsheetContent>
            <View />
          </ActionsheetContent>
        </Actionsheet>
      );

    it("clears the home indicator by a step", async () => {
      await renderContent();

      expect(bottomPadding()).toMatchObject({
        paddingBottom: INSETS.bottom + getTokenValue("$2", "space"),
      });
    });

    it("keeps its own padding where there is no home indicator", async () => {
      jest.mocked(useSafeAreaInsets).mockReturnValue({ ...INSETS, bottom: 0 });
      await renderContent();

      expect(bottomPadding()).toMatchObject({ paddingBottom: getTokenValue("$6", "space") });
    });
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

  // Content that speaks goes quiet once the sheet starts to leave.
  describe("open state for its content", () => {
    const OPEN = "open";
    // A hand catches a close this far below the detent it left.
    const PARTWAY_DOWN = -0.4;
    const TWO_DETENTS = [50, 90];
    const OpenProbe = () => <Text testID={OPEN}>{String(useActionsheetOpen())}</Text>;
    const Probed = ({ open, snapPoints }: { open: boolean; snapPoints?: number[] }) => (
      <Actionsheet isOpen={open} snapPoints={snapPoints}>
        <ActionsheetContent>
          <OpenProbe />
        </ActionsheetContent>
      </Actionsheet>
    );
    const readsOpen = () => screen.getByTestId(OPEN, hidden).props.children;
    /** gorhom's report that the sheet moves between two indexes. */
    const animate = (from: number, to: number) =>
      act(() => lastSheetProps()?.onAnimate?.(from, to));
    const moveTo = (index: number) => act(() => moveSheet(index));

    it("reads open while the sheet is up", async () => {
      await renderWithTheme(<Probed open />);

      expect(readsOpen()).toBe(String(true));
    });

    it("reads closed from the start of a close, while the content still shows", async () => {
      await renderWithTheme(<Probed open />);

      await animate(0, CLOSED_INDEX);

      expect(readsOpen()).toBe(String(false));
    });

    // gorhom reports nothing when a caught close springs back to its detent.
    it("reads open again once a caught close climbs back to its detent", async () => {
      await renderWithTheme(<Probed open />);
      await moveTo(0);

      await animate(0, CLOSED_INDEX);
      await moveTo(PARTWAY_DOWN);
      await moveTo(0);

      expect(readsOpen()).toBe(String(true));
    });

    it("reads open again once a caught close settles on another detent", async () => {
      await renderWithTheme(<Probed open snapPoints={TWO_DETENTS} />);

      await animate(0, CLOSED_INDEX);
      await animate(0, 1);

      expect(readsOpen()).toBe(String(true));
    });

    // Under Reduce Motion the content stays up while the sheet fades.
    it("reads closed once its owner closes it", async () => {
      mockReduced = true;
      await renderWithTheme(<Probed open />);

      await screen.rerender(<Probed open={false} />);

      expect(readsOpen()).toBe(String(false));
    });

    it("reads open at the next opening after a reader's escape", async () => {
      await renderWithTheme(<Probed open />);
      await animate(0, CLOSED_INDEX);
      await act(() =>
        fireEvent(screen.getByTestId(ACTIONSHEET_PART.LAYER, hidden), "accessibilityEscape")
      );

      await screen.rerender(<Probed open={false} />);
      await screen.rerender(<Probed open />);

      expect(readsOpen()).toBe(String(true));
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
