import { Text } from "react-native";
import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native";

import { SWIPE_TO_REMOVE_PART, SwipeToRemove } from "@/components/ui/swipe-to-remove";
import { A11Y_ACTION } from "@/constants/Accessibility";
import { ThemeProvider } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

const ROW = "3 Safar";
const LABEL = "Remove";
const HINT = "Counts the day as remaining again";

const renderRow = async () => {
  const onRemove = jest.fn();
  await render(
    <ThemeProvider>
      <SwipeToRemove label={LABEL} rowLabel={ROW} hint={HINT} onRemove={onRemove}>
        <Text>{ROW}</Text>
      </SwipeToRemove>
    </ThemeProvider>
  );
  return onRemove;
};

describe("SwipeToRemove", () => {
  it("reads as one element with its name, hint and a remove action", async () => {
    await renderRow();

    const row = screen.getByLabelText(ROW);
    expect(row.props.accessibilityHint).toBe(HINT);
    expect(row.props.accessibilityActions).toEqual([{ name: A11Y_ACTION.REMOVE, label: LABEL }]);
  });

  it("removes through the reader's action", async () => {
    const onRemove = await renderRow();

    await act(() =>
      fireEvent(screen.getByLabelText(ROW), "accessibilityAction", {
        nativeEvent: { actionName: A11Y_ACTION.REMOVE },
      })
    );

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("removes through the control the swipe shows", async () => {
    const onRemove = await renderRow();

    await userEvent.press(
      screen.getByTestId(SWIPE_TO_REMOVE_PART.REMOVE, { includeHiddenElements: true })
    );

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("keeps the sighted control from the reader", async () => {
    await renderRow();

    expect(screen.queryByTestId(SWIPE_TO_REMOVE_PART.REMOVE)).toBeNull();
  });
});
