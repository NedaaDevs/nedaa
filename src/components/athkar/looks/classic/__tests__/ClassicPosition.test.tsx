import { screen, userEvent } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { ClassicPosition, POSITION_PART } from "@/components/athkar/looks/classic/ClassicPosition";
import { MARK_SIZE, MARK_STATE } from "@/constants/AthkarSession";
import { renderWithTheme } from "@/test-helpers/theme";
import { positionMarks, type SessionItem } from "@/utils/athkarSession";
import { keyText } from "@/utils/athkarText";

const items = (count: number): SessionItem[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `${i}`,
    target: 1,
    texts: [keyText("text")],
    itemsPerRound: 1,
  }));

const LABEL = "Dhikr 9 of 18";
const FIGURES = "9 / 18";

const renderPosition = (onPress = jest.fn(), index: number | null = 8, length = 18) =>
  renderWithTheme(
    <ClassicPosition
      marks={positionMarks(items(length), {}, index)}
      figures={FIGURES}
      fraction={0.5}
      accessibilityLabel={LABEL}
      accessibilityHint="Opens the list"
      onPress={onPress}
    />
  );

/** Whether each full mark takes a share of the row's spare width. */
const fullMarksGrow = () =>
  screen
    .getAllByTestId(POSITION_PART[MARK_SIZE.FULL])
    .map((mark) => Boolean(StyleSheet.flatten(mark.props.style).flexGrow));

describe("ClassicPosition", () => {
  it("holds every full mark to one width beside fine marks", async () => {
    await renderPosition();
    expect(fullMarksGrow()).toEqual(Array(6).fill(false));
  });

  it("lets the marks of a short session share the row", async () => {
    await renderPosition(jest.fn(), 2, 6);
    expect(fullMarksGrow()).toEqual(Array(5).fill(true));
  });

  it("draws the marks near the place full size and the rest fine", async () => {
    await renderPosition();
    expect(screen.getAllByTestId(POSITION_PART[MARK_SIZE.FULL])).toHaveLength(6);
    expect(screen.getAllByTestId(POSITION_PART[MARK_STATE.CURRENT])).toHaveLength(1);
    expect(screen.getAllByTestId(POSITION_PART[MARK_SIZE.FINE])).toHaveLength(11);
  });

  it("draws no current mark for a finished session", async () => {
    await renderPosition(jest.fn(), null);
    expect(screen.queryByTestId(POSITION_PART[MARK_STATE.CURRENT])).toBeNull();
  });

  it("shows the figures and is one button for the reader", async () => {
    await renderPosition();
    expect(screen.getByText(FIGURES)).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: LABEL })).toBeOnTheScreen();
  });

  it("opens the list on a press", async () => {
    const onPress = jest.fn();
    await renderPosition(onPress);
    await userEvent.press(screen.getByRole("button", { name: LABEL }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
