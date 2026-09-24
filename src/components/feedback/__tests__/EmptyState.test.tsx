import { screen } from "@testing-library/react-native";

import { EmptyState } from "@/components/feedback/EmptyState";
import i18n from "@/localization/i18n";
import { renderWithTheme } from "@/test-helpers/theme";

type Element = ReturnType<typeof screen.getByRole>;

/** Whether an element above `node` groups it into one accessibility element. */
const insideAccessible = (node: Element) => {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.props.accessible === true) return true;
  }
  return false;
};

describe("EmptyState", () => {
  // iOS reads an accessible element as one; a button inside it cannot be focused.
  it("keeps its retry button reachable on its own", async () => {
    await renderWithTheme(<EmptyState type="error" onRetry={() => {}} />);

    const retry = screen.getByRole("button", { name: i18n.t("common.retry") });
    expect(insideAccessible(retry)).toBe(false);
  });

  it("still reads its message as one element", async () => {
    await renderWithTheme(<EmptyState type="error" onRetry={() => {}} />);

    const message = i18n.t("a11y.emptyState", {
      title: i18n.t("errors.prayerTimes.fetchFailed"),
      description: i18n.t("errors.prayerTimes.fetchDescription"),
    });
    expect(screen.getByLabelText(message)).toBeOnTheScreen();
  });
});
