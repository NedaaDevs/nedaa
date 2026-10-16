import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import AthkarSearchSheet from "@/components/athkar/AthkarSearchSheet";

// The close callback the sheet hands to its Actionsheet, captured so a test can
// close it the way a backdrop tap or drag would.
let mockSheetClose: (() => void) | null = null;

jest.mock("@/components/ui/actionsheet", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  const Pass = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(View, null, children);
  return {
    Actionsheet: ({
      isOpen,
      onClose,
      children,
    }: {
      isOpen: boolean;
      onClose: () => void;
      children?: React.ReactNode;
    }) => {
      mockSheetClose = onClose;
      return isOpen ? React.createElement(View, null, children) : null;
    },
    ActionsheetBackdrop: () => null,
    ActionsheetContent: Pass,
    ActionsheetDragIndicatorWrapper: Pass,
    ActionsheetDragIndicator: () => null,
    ActionsheetScrollView: Pass,
  };
});

// A function declaration hoists, so the mock factories above can call it before this line runs.
// The text slots render a host Text, the only host that may hold a string.
function mockPassthrough() {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View, Text } = jest.requireActual<typeof import("react-native")>("react-native");
  const Pass = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(View, null, children);
  const PassText = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(Text, null, children);
  Pass.Text = PassText;
  Pass.Pressable = Pass;
  Pass.Icon = Pass;
  return Pass;
}
jest.mock("@/components/ui/box", () => ({ Box: mockPassthrough() }));
jest.mock("@/components/ui/card", () => ({ Card: mockPassthrough() }));
jest.mock("@/components/ui/text", () => ({ Text: mockPassthrough().Text }));
jest.mock("@/components/ui/hstack", () => ({ HStack: mockPassthrough() }));
jest.mock("@/components/ui/vstack", () => ({ VStack: mockPassthrough() }));
jest.mock("@/components/ui/pressable", () => ({ Pressable: mockPassthrough() }));
jest.mock("@/components/ui/button", () => ({ Button: mockPassthrough() }));
jest.mock("@/components/ui/icon", () => ({ Icon: () => null }));
// Stands in as the plain input, so the behavioural assertions below still find it.
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock("@/components/ui/sheet-input", () => ({ SheetInput: require("react-native").TextInput }));

jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));
jest.mock("tamagui", () => ({
  useTheme: () => ({ typography: { val: "#000" }, typographySecondary: { val: "#888" } }),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", dir: () => "ltr" },
  }),
}));
jest.mock("@/hooks/useHaptic", () => ({ useHaptic: () => async () => {} }));
jest.mock("@/services/hisn-muslim-db", () => ({
  HisnMuslimDB: {
    getCategories: async () => [],
    search: async () => [],
    searchAthkar: async () => [],
    getAthkarByCategory: async () => [],
  },
}));
jest.mock("@/stores/my-athkar", () => {
  const state = {
    items: [],
    batchAddItems: async () => {},
    removeItem: async () => {},
    isSourceAdded: () => false,
    getItemBySourceId: () => undefined,
  };
  return {
    useMyAthkarStore: (select?: (s: typeof state) => unknown) => (select ? select(state) : state),
  };
});

const SEARCH_PLACEHOLDER = "athkar.myAthkar.search";

const open = async (onClose: () => void) => {
  await render(<AthkarSearchSheet isOpen onClose={onClose} />);
};

const input = () => screen.getByPlaceholderText(SEARCH_PLACEHOLDER);

beforeEach(() => {
  jest.useFakeTimers();
  mockSheetClose = null;
});
afterEach(() => jest.useRealTimers());

describe("AthkarSearchSheet", () => {
  it("hands a close from the sheet to the parent", async () => {
    const onClose = jest.fn();
    await open(onClose);

    await act(() => mockSheetClose?.());

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // The parent may keep the sheet mounted and only flip isOpen later, so the reset
  // cannot wait for a re-render; it happens in the close itself.
  it("clears the search as part of closing, before the parent reacts", async () => {
    await open(() => {});

    await fireEvent.changeText(input(), "dua");
    expect(input().props.value).toBe("dua");

    await act(() => mockSheetClose?.());

    expect(input().props.value).toBe("");
  });
});
