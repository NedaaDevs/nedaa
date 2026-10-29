import { act, fireEvent, screen } from "@testing-library/react-native";

type Element = ReturnType<typeof screen.getByTestId>;

const LAYOUT = { nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 44 } } };

/** Fires `element`'s layout, as its native view reports it once drawn. */
export const layOut = (element: Element) =>
  act(async () => {
    fireEvent(element, "layout", LAYOUT);
  });

/** The step's heading, the one header a step view draws. */
export const stepHeading = () => screen.getByRole("header");
