import { BackHandler } from "react-native";
import { screen, within } from "@testing-library/react-native";
import { getTokenValue } from "tamagui";

import { TimePickerBody, type TimePickerBodyProps } from "@/components/TimePickerBody";
import i18n from "@/localization/i18n";
import { androidBack } from "@/test-helpers/backHandler";
import { hostNodesIn, styleOf, type HostElement } from "@/test-helpers/text";
import { renderWithTheme } from "@/test-helpers/theme";

// Android's three-button navigation bar.
const mockInsets = { top: 0, right: 0, bottom: 48, left: 0 };
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => mockInsets,
}));

const t = i18n.t.bind(i18n);
const TITLE = t("settings.athkar.notifications.morning.title");
const COLUMNS = [t("common.hourLabel"), t("common.minute")];

const card = () => {
  const { parent } = screen.getByRole("header", { name: TITLE });
  if (!parent) throw new Error("the title is not in a card");
  return parent;
};

/** A column's list: the first host node in its radio group. */
const listOf = (column: string) => hostNodesIn(screen.getByLabelText(column))[1];

/** Each node from a list up to the card, with the node that holds it. */
const holders = (list: HostElement, top: HostElement) => {
  const pairs: [HostElement, HostElement][] = [];
  for (let node = list; node !== top;) {
    const { parent } = node;
    if (!parent) throw new Error("the list is not in the card");
    pairs.push([node, parent]);
    node = parent;
  }
  return pairs;
};

// A column gives height only to a child that shrinks; a row stretches its
// children to its own height.
const keepsHeight = ([node, holder]: [HostElement, HostElement]) => {
  const { flexDirection, alignItems = "stretch" } = styleOf(holder) ?? {};
  const { flexShrink = 0, alignSelf, height } = styleOf(node) ?? {};
  if (flexDirection !== "row") return flexShrink <= 0;
  const align = alignSelf && alignSelf !== "auto" ? alignSelf : alignItems;
  return align !== "stretch" || height !== undefined;
};

const picker = ({
  onTimeChange = jest.fn(),
  onClose = jest.fn(),
}: Partial<TimePickerBodyProps> = {}) => (
  <TimePickerBody
    title={TITLE}
    currentHour={17}
    currentMinute={30}
    use12HourFormat
    isPM
    onTimeChange={onTimeChange}
    onClose={onClose}
  />
);

describe("TimePickerBody", () => {
  // Each radio says only its number, so its group names the column.
  it("groups the hours and the minutes under their column names", async () => {
    await renderWithTheme(picker());

    const hours = screen.getByLabelText(t("common.hourLabel"));
    const minutes = screen.getByLabelText(t("common.minute"));
    expect(hours).toHaveProp("accessibilityRole", "radiogroup");
    expect(minutes).toHaveProp("accessibilityRole", "radiogroup");
    expect(within(hours).getByRole("radio", { name: "5", selected: true })).toBeTruthy();
    expect(within(minutes).getByRole("radio", { name: "30", selected: true })).toBeTruthy();
  });

  // The time alone does not say which reminder it sets.
  it("names the picker with its title", async () => {
    await renderWithTheme(picker());

    expect(screen.getByRole("header", { name: TITLE })).toBeTruthy();
  });

  it("cancels on Android's back", async () => {
    const pressBack = androidBack();
    const onTimeChange = jest.fn();
    const onClose = jest.fn();
    await renderWithTheme(picker({ onTimeChange, onClose }));

    expect(await pressBack()).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onTimeChange).not.toHaveBeenCalled();
  });

  // A caller's inline onClose is a new function on every render.
  it("leaves back to a dialog above it when its parent re-renders", async () => {
    const pressBack = androidBack();
    const onClose = jest.fn();
    await renderWithTheme(picker());
    const above = jest.fn(() => true);
    BackHandler.addEventListener("hardwareBackPress", above);
    await screen.rerender(picker({ onClose }));

    expect(await pressBack()).toBe(true);
    expect(above).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("cancels through the onClose of its latest render", async () => {
    const pressBack = androidBack();
    const onClose = jest.fn();
    await renderWithTheme(picker());
    await screen.rerender(picker({ onClose }));

    await pressBack();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // The root safe area leaves the bottom inset to each screen.
  describe("on a screen shorter than the picker", () => {
    // A percentage height resolves inside the parent's padding.
    it("holds the card to the height above the bottom inset", async () => {
      await renderWithTheme(picker());

      expect(card().parent).toHaveStyle({ paddingBottom: mockInsets.bottom });
      expect(card()).toHaveStyle({ maxHeight: "100%" });
    });

    it("takes the height from the hour and minute lists alone", async () => {
      await renderWithTheme(picker());

      const lists = COLUMNS.map(listOf);
      for (const list of lists) {
        expect(
          holders(list, card())
            .filter(keepsHeight)
            .map(([node]) => styleOf(node))
        ).toEqual([]);
      }
      const passes = holders(lists[0], card()).map(([node]) => node);
      const rest = card().children.filter(
        (child): child is HostElement => typeof child !== "string" && !passes.includes(child)
      );
      expect(rest.filter((child) => !keepsHeight([child, card()])).map(styleOf)).toEqual([]);
    });

    it("shrinks each list no lower than a touch target", async () => {
      await renderWithTheme(picker());

      for (const column of COLUMNS) {
        expect(listOf(column)).toHaveStyle({ minHeight: getTokenValue("$target", "size") });
      }
    });
  });
});
