import { screen } from "@testing-library/react-native";

import MyAthkarEmpty from "@/components/athkar/MyAthkarEmpty";
import { MY_ATHKAR_PART } from "@/constants/Athkar";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));

describe("MyAthkarEmpty", () => {
  // The larger text sizes leave one line too narrow for both buttons.
  it("wraps its buttons onto centred lines when one line cannot hold both", async () => {
    await renderWithTheme(<MyAthkarEmpty onOpenSearch={jest.fn()} />);

    expect(screen.getByTestId(MY_ATHKAR_PART.EMPTY_ACTIONS)).toHaveStyle({
      flexWrap: "wrap",
      justifyContent: "center",
    });
  });
});
