import { screen } from "@testing-library/react-native";

import { SESSION_DONE_ID, SessionDone } from "@/components/athkar/session/SessionDone";
import { renderWithTheme } from "@/test-helpers/theme";

const MESSAGE = "Morning athkar complete for today";

describe("SessionDone", () => {
  it("shows the message it is given", async () => {
    await renderWithTheme(<SessionDone message={MESSAGE} announce={false} />);
    expect(screen.getByTestId(SESSION_DONE_ID)).toBeOnTheScreen();
    expect(screen.getByText(MESSAGE)).toBeOnTheScreen();
  });
});
