import { screen, userEvent, within } from "@testing-library/react-native";

import NotificationTypePanel from "@/components/NotificationTypePanel";
import { NOTIFICATION_TYPE, SYSTEM_SOUND } from "@/constants/Notification";
import i18n from "@/localization/i18n";
import { renderWithTheme } from "@/test-helpers/theme";
import type { NotificationWithTiming } from "@/types/notification";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@/hooks/useHaptic", () => ({ useHaptic: () => jest.fn() }));
jest.mock("@/components/PrayerCustomizationModal", () => () => null);

const TITLE = "Before the athan";
const MINUTES = 10;
const DEFAULTS: NotificationWithTiming = {
  enabled: true,
  sound: SYSTEM_SOUND,
  vibration: true,
  timing: MINUTES,
};

const renderPanel = (defaults = DEFAULTS, hasTiming = false) =>
  renderWithTheme(
    <NotificationTypePanel
      type={NOTIFICATION_TYPE.PRE_ATHAN}
      title={TITLE}
      icon="Bell"
      defaults={defaults}
      overrides={{}}
      onDefaultUpdate={jest.fn()}
      onOverrideUpdate={jest.fn()}
      onResetOverride={jest.fn()}
      hasTiming={hasTiming}
    />
  );

const header = () => screen.getByRole("button", { name: TITLE });

describe("NotificationTypePanel", () => {
  it("gives the reader a button that opens the panel and says if it is open", async () => {
    await renderPanel();
    expect(header()).toBeCollapsed();

    await userEvent.press(header());

    expect(header()).toBeExpanded();
  });

  // A switch inside an accessible element cannot take the reader's focus.
  it("keeps the switch outside the button, where the reader reaches it", async () => {
    await renderPanel();

    expect(screen.getByRole("switch", { name: TITLE })).toBeOnTheScreen();
    expect(within(header()).queryByRole("switch")).toBeNull();
  });

  it("reads the timing badge as the button's value", async () => {
    await renderPanel(DEFAULTS, true);

    expect(header()).toHaveProp("accessibilityValue", {
      text: i18n.t("common.minute", { count: MINUTES }),
    });
  });

  it("holds the button still while the type is off", async () => {
    await renderPanel({ ...DEFAULTS, enabled: false });

    expect(header()).toBeDisabled();
  });
});
