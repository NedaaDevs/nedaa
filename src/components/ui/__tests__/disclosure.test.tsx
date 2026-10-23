import { StyleSheet, Text } from "react-native";
import { act, fireEvent, screen, userEvent } from "@testing-library/react-native";
import { withTiming } from "react-native-reanimated";

import config from "../../../../tamagui.config";
import { DISCLOSURE_PART, Disclosure } from "@/components/ui/disclosure";
import { fontSizeOf } from "@/test-helpers/text";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

let mockReduced = false;
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => mockReduced }));

const LIGHT = config.themes.light;
const hidden = { includeHiddenElements: true };
const style = (id: string) =>
  Object.assign({}, ...[screen.getByTestId(id, hidden).props.style].flat(Infinity));

const renderDisclosure = () =>
  renderWithTheme(
    <Disclosure title="Other times">
      <Text>Sunrise</Text>
    </Disclosure>
  );
const summary = () => screen.getByRole("button", { name: "Other times" });
const measure = (height: number) =>
  act(() =>
    fireEvent(screen.getByTestId(DISCLOSURE_PART.CONTENT, hidden), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 300, height } },
    })
  );

describe("Disclosure", () => {
  beforeEach(() => {
    mockReduced = false;
    jest.clearAllMocks();
  });

  it("starts closed, its body out of the reader's way", async () => {
    await renderDisclosure();

    expect(summary().props.accessibilityState).toMatchObject({ expanded: false });
    expect(screen.queryByText("Sunrise")).toBeNull();
    expect(style(DISCLOSURE_PART.BODY).height).toBe(0);
  });

  it("opens to its content's height when the summary is pressed", async () => {
    await renderDisclosure();
    await measure(96);

    await userEvent.setup().press(summary());

    expect(summary().props.accessibilityState).toMatchObject({ expanded: true });
    expect(screen.getByText("Sunrise")).toBeOnTheScreen();
    expect(style(DISCLOSURE_PART.BODY).height).toBe(96);
    expect(style(DISCLOSURE_PART.CHEVRON).transform).toEqual([{ rotate: "180deg" }]);
    expect(withTiming).toHaveBeenCalled();
  });

  it("keeps its summary at the touch floor", async () => {
    await renderDisclosure();

    expect(summary()).toHaveStyle({ minHeight: 44 });
  });

  it("draws its summary at the md size", async () => {
    await renderDisclosure();

    expect(screen.getByText("Other times")).toHaveStyle({ fontSize: fontSizeOf("md") });
  });

  it("opens at once under reduced motion", async () => {
    mockReduced = true;
    await renderDisclosure();

    await userEvent.setup().press(summary());

    expect(withTiming).not.toHaveBeenCalled();
  });

  it("closes on a hairline rule under a full-ink summary", async () => {
    await renderDisclosure();

    expect(screen.getByTestId(DISCLOSURE_PART.ROOT)).toHaveStyle({ borderBottomWidth: 1 });
    expect(screen.getByText("Other times")).toHaveStyle({ color: LIGHT.fg.val });
  });

  // A secondary door: the gap around it separates it, not a line.
  describe("quiet", () => {
    const renderQuiet = () =>
      renderWithTheme(
        <Disclosure title="Other times" quiet>
          <Text>Sunrise</Text>
        </Disclosure>
      );

    it("draws no rule", async () => {
      await renderQuiet();

      expect(style(DISCLOSURE_PART.ROOT).borderBottomWidth).toBeUndefined();
    });

    it("sets its summary muted, at the md size in the semibold face", async () => {
      await renderQuiet();
      const title = screen.getByText("Other times");

      expect(title).toHaveStyle({ fontSize: fontSizeOf("md"), color: LIGHT.mutedSky.val });
      expect(String(StyleSheet.flatten(title.props.style).fontFamily)).toMatch(/SemiBold/);
    });

    it("keeps its summary at the touch floor and its toggle", async () => {
      await renderQuiet();

      expect(summary()).toHaveStyle({ minHeight: 44 });
      await userEvent.setup().press(summary());
      expect(summary().props.accessibilityState).toMatchObject({ expanded: true });
    });
  });
});
