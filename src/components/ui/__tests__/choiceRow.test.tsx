import { StyleSheet, Text } from "react-native";
import { act, fireEvent, screen, userEvent } from "@testing-library/react-native";

import { CHOICE_ROW_PART, ChoiceGroup, ChoiceRow } from "@/components/ui/choice-row";
import i18n from "@/localization/i18n";
import { controlProblems } from "@/test-helpers/controls";
import { renderWithTheme } from "@/test-helpers/theme";

let mockReduced = false;
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => mockReduced }));

const GROUP = "Appearance";
const OPTIONS = [
  { id: "light", title: "Light", subtitle: "Always bright" },
  { id: "dark", title: "Dark", subtitle: "Always dark" },
] as const;

type Setup = { selected?: string; onPress?: (id: string) => void };

const renderGroup = ({ selected = "light", onPress = jest.fn() }: Setup = {}) =>
  renderWithTheme(
    <ChoiceGroup label={GROUP}>
      {OPTIONS.map(({ id, title, subtitle }) => (
        <ChoiceRow
          key={id}
          title={title}
          subtitle={subtitle}
          selected={selected === id}
          onPress={() => onPress(id)}
          leading={<Text testID={`leading-${id}`}>*</Text>}
        />
      ))}
    </ChoiceGroup>
  );

const rows = () => screen.getAllByRole("radio");
const checks = () => screen.getAllByTestId(CHOICE_ROW_PART.CHECK, { includeHiddenElements: true });
const ticks = () => screen.queryAllByTestId(CHOICE_ROW_PART.TICK, { includeHiddenElements: true });

const styleOf = (row: ReturnType<typeof rows>[number]) => StyleSheet.flatten(row.props.style);

describe("ChoiceRow", () => {
  beforeEach(() => {
    mockReduced = false;
  });

  it("reads each row as a radio in a named group", async () => {
    await renderGroup();

    expect(screen.getByLabelText(GROUP)).toHaveProp("accessibilityRole", "radiogroup");
    expect(rows().map((row) => row.props.accessibilityLabel)).toEqual(
      OPTIONS.map(({ title, subtitle }) => i18n.t("a11y.join", { first: title, second: subtitle }))
    );
  });

  it("marks only the chosen row selected, by state and by its check", async () => {
    await renderGroup({ selected: "dark" });

    expect(rows().map((row) => row.props.accessibilityState?.selected)).toEqual([false, true]);
    expect(checks()).toHaveLength(2);
    expect(ticks()).toHaveLength(1);
  });

  it("reports a press", async () => {
    const onPress = jest.fn();
    await renderGroup({ onPress });

    await userEvent.setup().press(rows()[1]);

    expect(onPress).toHaveBeenCalledWith("dark");
  });

  it("draws what it is given at the start", async () => {
    await renderGroup();

    expect(screen.getByTestId("leading-light")).toBeOnTheScreen();
  });

  it("reads the title alone when there is no subtitle", async () => {
    await renderWithTheme(<ChoiceRow title="العربية" selected={false} onPress={jest.fn()} />);

    expect(rows()[0]).toHaveProp("accessibilityLabel", "العربية");
  });

  it("gives every row a role, a name and a 44pt target", async () => {
    await renderGroup();

    expect(controlProblems()).toEqual([]);
  });

  it("draws its own edge", async () => {
    await renderGroup();

    expect(styleOf(rows()[0]).borderTopWidth).toBe(1);
  });

  // A card under the finger shrinks a touch and keeps its full colour.
  it.each([
    [false, [{ scale: 0.99 }]],
    [true, undefined],
  ] as const)("presses in (Reduce Motion: %s)", async (reduced, transform) => {
    mockReduced = reduced;
    await renderGroup();

    await act(() => fireEvent(rows()[0], "responderGrant", { nativeEvent: {} }));

    expect(styleOf(rows()[0])).toMatchObject({ opacity: 1 });
    expect(styleOf(rows()[0]).transform).toEqual(transform);
  });
});
