import { screen } from "@testing-library/react-native";

import {
  FOCUS_HINT_PART,
  FocusGestureMarks,
  FocusSideMarks,
} from "@/components/athkar/session/FocusHint";
import i18n from "@/localization/i18n";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

const t = i18n.t.bind(i18n);
const hidden = { includeHiddenElements: true };

describe("the Focus hint", () => {
  it("marks the next and the previous dhikr, next first", async () => {
    await renderWithTheme(<FocusSideMarks visible />);
    const marks = screen.getByTestId(FOCUS_HINT_PART.SIDES, hidden);
    const words = screen.getAllByText(/./, hidden).map((node) => node.props.children);
    expect(marks).toBeOnTheScreen();
    expect(words).toEqual([t("athkar.focus.next"), t("athkar.audio.previous")]);
  });

  it("marks the tap, the hold and the undo", async () => {
    await renderWithTheme(<FocusGestureMarks visible />);
    for (const key of ["athkar.focus.hint.tap", "athkar.focus.hint.hold", "athkar.session.undo"]) {
      expect(screen.getByText(t(key), hidden)).toBeOnTheScreen();
    }
  });

  it("is kept from a screen reader", async () => {
    await renderWithTheme(<FocusGestureMarks visible />);
    expect(screen.queryByText(t("athkar.focus.hint.tap"))).toBeNull();
  });

  it("goes clear when it is no longer visible", async () => {
    await renderWithTheme(<FocusSideMarks visible={false} />);
    expect(screen.getByTestId(FOCUS_HINT_PART.SIDES, hidden)).toHaveStyle({ opacity: 0 });
  });
});
