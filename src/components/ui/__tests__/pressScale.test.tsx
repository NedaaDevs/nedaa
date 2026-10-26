import { StyleSheet } from "react-native";
import { act, fireEvent, renderHook, screen } from "@testing-library/react-native";

import { Card } from "@/components/ui/card";
import { LIST_ROW_VARIANT, ListRow } from "@/components/ui/list-row";
import { usePressScale } from "@/components/ui/pressable/pressScale";
import { renderWithTheme } from "@/test-helpers/theme";

let mockReduced = false;
jest.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: () => mockReduced }));

beforeEach(() => {
  mockReduced = false;
});

const SURFACE = "surface";
const surface = () => screen.getByTestId(SURFACE);
const press = () => act(() => fireEvent(surface(), "responderGrant", { nativeEvent: {} }));
const transformOf = () => StyleSheet.flatten(surface().props.style).transform;

const PRESSABLES = [
  ["Card.Pressable", () => <Card.Pressable testID={SURFACE} onPress={jest.fn()} />],
  ["the standalone ListRow", () => <ListRow title="Alarms" onPress={jest.fn()} />],
] as const;

describe("press scale", () => {
  // A pressed row or card shrinks to .98 on the snap spring.
  it.each(PRESSABLES)("%s shrinks to .98 under the finger", async (_name, Surface) => {
    await renderWithTheme(<Surface />);

    await act(() => fireEvent(screen.getByRole("button"), "responderGrant", { nativeEvent: {} }));

    expect(StyleSheet.flatten(screen.getByRole("button").props.style).transform).toEqual([
      { scale: 0.98 },
    ]);
  });

  it.each(PRESSABLES)("%s holds still under reduced motion", async (_name, Surface) => {
    mockReduced = true;
    await renderWithTheme(<Surface />);

    await act(() => fireEvent(screen.getByRole("button"), "responderGrant", { nativeEvent: {} }));

    expect(StyleSheet.flatten(screen.getByRole("button").props.style).transform).toBeUndefined();
  });

  // A grouped row lies flat on its group; only its wash answers the touch.
  it("leaves a grouped row unscaled", async () => {
    await renderWithTheme(
      <ListRow title="Alarms" onPress={jest.fn()} variant={LIST_ROW_VARIANT.GROUPED} />
    );

    await act(() => fireEvent(screen.getByRole("button"), "responderGrant", { nativeEvent: {} }));

    expect(StyleSheet.flatten(screen.getByRole("button").props.style).transform).toBeUndefined();
  });

  // Down is a short timing under the finger; up is the snap spring.
  it("goes down on the press timing and comes back on the snap spring", async () => {
    const { result } = await renderHook(() => usePressScale());

    expect(result.current.pressStyle).toMatchObject({ scale: 0.98, transition: "press" });
    expect(result.current.transition).toBe("springSnap");
  });

  it("keeps the card's dim beside the scale", async () => {
    await renderWithTheme(<Card.Pressable testID={SURFACE} onPress={jest.fn()} />);

    await press();

    expect(StyleSheet.flatten(surface().props.style)).toMatchObject({ opacity: 0.7 });
    expect(transformOf()).toEqual([{ scale: 0.98 }]);
  });
});
