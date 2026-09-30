import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { act, fireEvent, screen, userEvent } from "@testing-library/react-native";
import { withTiming } from "react-native-reanimated";
import { Bell } from "lucide-react-native";

import { ICON_SIZES } from "@/components/ui/icon/sizing";
import { DURATION_MS } from "@/constants/Motion";
import { SWITCH_GROUP_PART, SwitchGroup } from "@/components/ui/switch-group";
import { controlProblems } from "@/test-helpers/controls";
import { fontSizeOf } from "@/test-helpers/text";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));

let mockReduced = false;
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => mockReduced }));

const LABEL = "Athan";
const SUMMARY = "Makkah";
const HINT = "Plays at prayer time";
const BODY = "Sound";
const NAME = `${LABEL}, ${SUMMARY}`;
const NESTED = "Vibration";

const Group = ({ initial = false }: { initial?: boolean }) => {
  const [on, setOn] = useState(initial);
  return (
    <SwitchGroup
      icon={Bell}
      label={LABEL}
      summary={SUMMARY}
      hint={HINT}
      value={on}
      onValueChange={setOn}>
      <Text>{BODY}</Text>
    </SwitchGroup>
  );
};

const row = () => screen.getByRole("switch", { name: NAME });
type Host = ReturnType<typeof row>;
const styleOf = (element: Host) => StyleSheet.flatten(element.props.style) ?? {};

const hidden = { includeHiddenElements: true };
const bodyStyle = () => styleOf(screen.getByTestId(SWITCH_GROUP_PART.BODY, hidden));
const measure = (height: number) =>
  act(() =>
    fireEvent(screen.getByTestId(SWITCH_GROUP_PART.CONTENT, hidden), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 300, height } },
    })
  );

describe("SwitchGroup", () => {
  beforeEach(() => {
    mockReduced = false;
    jest.clearAllMocks();
  });

  it("reads as one switch with its name, summary, hint and state", async () => {
    await renderWithTheme(<Group initial />);

    expect(screen.getAllByRole("switch")).toHaveLength(1);
    expect(row()).toBeChecked();
    expect(row().props.accessibilityHint).toBe(HINT);
  });

  it("reads its label alone when it has no summary", async () => {
    await renderWithTheme(<SwitchGroup label={LABEL} value={false} onValueChange={jest.fn()} />);

    expect(screen.getByRole("switch", { name: LABEL })).not.toBeChecked();
  });

  it("toggles when the row is pressed", async () => {
    const onValueChange = jest.fn();
    await renderWithTheme(
      <SwitchGroup label={LABEL} summary={SUMMARY} value={false} onValueChange={onValueChange} />
    );

    await userEvent.setup().press(row());

    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it("reads busy and ignores presses while busy", async () => {
    const onValueChange = jest.fn();
    await renderWithTheme(
      <SwitchGroup
        label={LABEL}
        summary={SUMMARY}
        value={false}
        busy
        onValueChange={onValueChange}
      />
    );

    expect(row().props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    await userEvent.setup().press(row());
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("shows its body only while the switch is on", async () => {
    await renderWithTheme(<Group />);
    expect(screen.queryByText(BODY)).toBeNull();

    await userEvent.setup().press(row());
    expect(row()).toBeChecked();
    expect(screen.getByText(BODY)).toBeOnTheScreen();

    await userEvent.setup().press(row());
    expect(screen.queryByText(BODY)).toBeNull();
  });

  it("keeps the row at the touch floor with a role and a name", async () => {
    await renderWithTheme(<Group initial />);

    expect(Number(styleOf(row()).minHeight)).toBeGreaterThanOrEqual(44);
    expect(controlProblems()).toEqual([]);
  });

  it("draws a divider under a group", async () => {
    await renderWithTheme(<Group initial />);

    expect(styleOf(row().parent!)).toMatchObject({ borderBottomWidth: 1 });
  });

  // The icon's width plus the row's gap, so the body lines up under the label.
  it("starts its body where the label starts", async () => {
    await renderWithTheme(<Group initial />);

    const body = screen.getByText(BODY).parent!.parent!;
    const [spacer] = body.children as Host[];
    expect(styleOf(body).gap).toBe(styleOf(row()).gap);
    expect(styleOf(spacer!).width).toBe(ICON_SIZES.lg);
  });

  it("grows its body to the content's height when switched on", async () => {
    await renderWithTheme(<Group />);

    await userEvent.setup().press(row());
    await measure(120);

    expect(bodyStyle().height).toBe(120);
    expect(withTiming).toHaveBeenCalled();
  });

  it("folds its body away and hides it from the reader when switched off", async () => {
    await renderWithTheme(<Group initial />);
    await measure(120);

    await userEvent.setup().press(row());

    expect(bodyStyle().height).toBe(0);
    expect(screen.queryByText(BODY)).toBeNull();
  });

  it("opens at once, at full height, under reduced motion", async () => {
    mockReduced = true;
    await renderWithTheme(<Group />);

    await userEvent.setup().press(row());
    await measure(120);

    expect(withTiming).not.toHaveBeenCalled();
    expect(bodyStyle().height).toBe(120);
  });

  // A body left mounted keeps its sound preview playing with no way to stop it.
  it("unmounts its body once the fold closes", async () => {
    jest.useFakeTimers();
    await renderWithTheme(<Group initial />);
    await measure(120);

    await userEvent.setup({ advanceTimers: jest.advanceTimersByTime }).press(row());
    expect(screen.getByText(BODY, hidden)).toBeTruthy();
    await act(() => jest.advanceTimersByTimeAsync(DURATION_MS.SETTLE));

    expect(screen.queryByText(BODY, hidden)).toBeNull();
    jest.useRealTimers();
  });

  it("unmounts its body at once under reduced motion", async () => {
    mockReduced = true;
    await renderWithTheme(<Group initial />);

    await userEvent.setup().press(row());

    expect(screen.queryByText(BODY, hidden)).toBeNull();
  });

  it("titles its row at the md size over an sm summary", async () => {
    await renderWithTheme(<Group />);

    expect(screen.getByText(LABEL)).toHaveStyle({ fontSize: fontSizeOf("md") });
    expect(screen.getByText(SUMMARY)).toHaveStyle({ fontSize: fontSizeOf("sm") });
  });

  // A switch inside a group is a setting of it: no divider, the same title.
  it("draws a nested switch as a row without a divider", async () => {
    await renderWithTheme(
      <SwitchGroup icon={Bell} label={LABEL} summary={SUMMARY} value onValueChange={jest.fn()}>
        <SwitchGroup label={NESTED} value={false} onValueChange={jest.fn()} />
      </SwitchGroup>
    );

    const nested = screen.getByRole("switch", { name: NESTED });
    expect(styleOf(nested.parent!).borderBottomWidth).toBeUndefined();
    const title = styleOf(screen.getByText(LABEL));
    expect(styleOf(screen.getByText(NESTED))).toMatchObject({
      fontFamily: title.fontFamily,
      fontSize: title.fontSize,
    });
  });
});
