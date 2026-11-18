// First: expo-router's testing library re-mocks Reanimated as it loads, and
// the screens must bind to the mock below, not to its empty one.
import EditCustomAthkar from "@/app/custom-athkar/[id]";
import NewCustomAthkar from "@/app/custom-athkar/new";
import { Alert, Text } from "react-native";
import { usePathname } from "expo-router";
import { act, userEvent } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";
import { getTokenValue } from "tamagui";

import { MessageToast } from "@/components/feedback";
import { STEPPER_PART } from "@/components/ui/stepper";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { CUSTOM_ATHKAR_HREF } from "@/constants/Athkar";
import i18n from "@/localization/i18n";
import { useCustomAthkarStore } from "@/stores/custom-athkar";
import { controlProblems } from "@/test-helpers/controls";
import { ThemeProvider } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
jest.mock("@/hooks/useHaptic", () => jest.requireActual("@/test-helpers/hapticMock"));
jest.mock("@/components/feedback", () => ({
  MessageToast: { showSuccess: jest.fn(), showError: jest.fn() },
}));

const t = i18n.t.bind(i18n);

const GROUP = { id: 3, title: "After prayer", sortOrder: 0 };
/** The navigator's names: the file paths under src/app. */
const NEW_ROUTE = CUSTOM_ATHKAR_HREF.NEW.slice(1);
const EDIT_ROUTE = "custom-athkar/[id]";
const EDIT_HREF = `/custom-athkar/${GROUP.id}`;

const createGroup = jest.fn(async (): Promise<number | null> => 9);
const updateGroup = jest.fn(async () => true);
const deleteGroup = jest.fn(async () => {});

const Pathname = () => <Text testID="pathname">{usePathname()}</Text>;

const renderAt = (href: string) =>
  renderRouter(
    {
      [BACK_DESTINATION.ATHKAR.route]: Pathname,
      [NEW_ROUTE]: NewCustomAthkar,
      [EDIT_ROUTE]: EditCustomAthkar,
    },
    { initialUrl: href, wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider> }
  );

const nameField = () => screen.getByPlaceholderText(t("athkar.customAthkar.titlePlaceholder"));
const dhikrFields = () =>
  screen.getAllByPlaceholderText(t("athkar.customAthkar.thikirPlaceholder"));
const saveButton = () => screen.getByRole("button", { name: t("athkar.customAthkar.saveGroup") });

beforeEach(() => {
  jest.clearAllMocks();
  useCustomAthkarStore.setState({
    groups: [GROUP],
    items: [
      { id: 30, groupId: GROUP.id, arabicText: "أستغفر الله", userCount: 3, sortOrder: 0 },
      { id: 31, groupId: GROUP.id, arabicText: "سبحان الله", userCount: 33, sortOrder: 1 },
    ],
    progress: [],
    createGroup,
    updateGroup,
    deleteGroup,
  });
});

describe("new custom group", () => {
  it("saves the name and each dhikr with its repeat count, once", async () => {
    let finish: (id: number | null) => void = () => {};
    createGroup.mockImplementation(() => new Promise((done) => (finish = done)));
    const user = userEvent.setup();
    await renderAt(CUSTOM_ATHKAR_HREF.NEW);

    await user.type(nameField(), "Before sleep");
    await user.type(dhikrFields()[0], "باسمك اللهم");
    await user.press(
      screen.getAllByTestId(STEPPER_PART.INCREMENT, { includeHiddenElements: true })[0]
    );
    await user.press(screen.getByRole("button", { name: t("athkar.customAthkar.addRow") }));
    await user.type(dhikrFields()[1], "الحمد لله");
    await user.press(saveButton());
    await user.press(saveButton());
    await act(async () => finish(9));

    expect(createGroup).toHaveBeenCalledTimes(1);
    expect(createGroup).toHaveBeenCalledWith("Before sleep", [
      { arabicText: "باسمك اللهم", userCount: 2 },
      { arabicText: "الحمد لله", userCount: 1 },
    ]);
    expect(MessageToast.showSuccess).toHaveBeenCalledWith(t("athkar.customAthkar.saved"));
    expect(screen.getByTestId("pathname")).toHaveTextContent(
      BACK_DESTINATION.ATHKAR.href as string
    );
  });

  it("titles the athkar section in the screen's own spelling", async () => {
    await renderAt(CUSTOM_ATHKAR_HREF.NEW);

    expect(screen.queryByText(t("athkar.customAthkar.thikirs"))).toBeNull();
    expect(screen.getAllByText(t("athkar.customAthkar.rowsSection")).length).toBeGreaterThan(0);
  });

  // A line count fixes an Android field's height; the field grows with the dhikr instead.
  it("lets a dhikr field grow with its text", async () => {
    await renderAt(CUSTOM_ATHKAR_HREF.NEW);

    expect(dhikrFields()[0].props.numberOfLines).toBeUndefined();
    expect(dhikrFields()[0]).toHaveStyle({ minHeight: getTokenValue("$24", "size") });
  });

  it("counts the rows and lets only a second row be deleted", async () => {
    const user = userEvent.setup();
    await renderAt(CUSTOM_ATHKAR_HREF.NEW);
    const deleteRow = (number: number) => t("a11y.customAthkar.deleteRow", { number });

    expect(screen.getByText(t("athkar.customAthkar.rowCount", { count: 1 }))).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: deleteRow(1) })).toBeNull();
    await user.press(screen.getByRole("button", { name: t("athkar.customAthkar.addRow") }));
    expect(screen.getByText(t("athkar.customAthkar.rowCount", { count: 2 }))).toBeOnTheScreen();

    await user.press(screen.getByRole("button", { name: deleteRow(2) }));

    expect(dhikrFields()).toHaveLength(1);
  });

  it("asks for a name before saving", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const user = userEvent.setup();
    await renderAt(CUSTOM_ATHKAR_HREF.NEW);

    await user.type(dhikrFields()[0], "الحمد لله");
    await user.press(saveButton());

    expect(alert).toHaveBeenCalledWith(t("athkar.customAthkar.nameRequired"));
    expect(createGroup).not.toHaveBeenCalled();
  });

  it("asks for the text of every dhikr before saving", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const user = userEvent.setup();
    await renderAt(CUSTOM_ATHKAR_HREF.NEW);

    await user.type(nameField(), "Before sleep");
    await user.press(saveButton());

    expect(alert).toHaveBeenCalledWith(t("athkar.customAthkar.textRequired"));
    expect(createGroup).not.toHaveBeenCalled();
  });

  it("stays and says so when saving fails", async () => {
    createGroup.mockResolvedValue(null);
    const user = userEvent.setup();
    await renderAt(CUSTOM_ATHKAR_HREF.NEW);

    await user.type(nameField(), "Before sleep");
    await user.type(dhikrFields()[0], "الحمد لله");
    await user.press(saveButton());

    expect(MessageToast.showError).toHaveBeenCalledWith(t("athkar.customAthkar.saveFailed"));
    expect(nameField().props.value).toBe("Before sleep");
  });

  it("names every control and gives it a full target", async () => {
    await renderAt(CUSTOM_ATHKAR_HREF.NEW);

    expect(controlProblems()).toEqual([]);
  });
});

describe("editing a custom group", () => {
  it("opens with the group's name and athkar, and saves the edit", async () => {
    const user = userEvent.setup();
    await renderAt(EDIT_HREF);

    expect(nameField().props.value).toBe(GROUP.title);
    expect(dhikrFields().map((field) => field.props.value)).toEqual(["أستغفر الله", "سبحان الله"]);
    await user.clear(dhikrFields()[1]);
    await user.type(dhikrFields()[1], "الله أكبر");
    await user.press(saveButton());

    expect(updateGroup).toHaveBeenCalledWith(GROUP.id, GROUP.title, [
      { arabicText: "أستغفر الله", userCount: 3 },
      { arabicText: "الله أكبر", userCount: 33 },
    ]);
  });

  it("counts a repeat past three digits", async () => {
    useCustomAthkarStore.setState({
      items: [
        { id: 30, groupId: GROUP.id, arabicText: "أستغفر الله", userCount: 999, sortOrder: 0 },
      ],
    });
    const user = userEvent.setup();
    await renderAt(EDIT_HREF);

    await user.press(screen.getByTestId(STEPPER_PART.INCREMENT, { includeHiddenElements: true }));
    await user.press(saveButton());

    expect(updateGroup).toHaveBeenCalledWith(GROUP.id, GROUP.title, [
      { arabicText: "أستغفر الله", userCount: 1000 },
    ]);
  });

  it("deletes the group once its removal is confirmed", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const user = userEvent.setup();
    await renderAt(EDIT_HREF);

    await user.press(screen.getByRole("button", { name: t("athkar.customAthkar.deleteGroup") }));
    const [title, body, buttons] = alert.mock.calls[0];
    expect([title, body]).toEqual([
      t("athkar.customAthkar.deleteConfirm"),
      t("athkar.customAthkar.deleteWarning"),
    ]);
    const confirm = buttons?.find(({ style }) => style === "destructive");
    await act(async () => confirm?.onPress?.());

    expect(deleteGroup).toHaveBeenCalledWith(GROUP.id);
    expect(screen.getByTestId("pathname")).toHaveTextContent(
      BACK_DESTINATION.ATHKAR.href as string
    );
  });

  it("leaves out the note a new group shows", async () => {
    await renderAt(EDIT_HREF);

    expect(screen.queryByText(t("athkar.customAthkar.saveNote"))).toBeNull();
  });
});
