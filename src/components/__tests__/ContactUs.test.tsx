import { screen } from "@testing-library/react-native";
import type { ParseKeys } from "i18next";

import ContactUs from "@/components/ContactUs";
import i18n from "@/localization/i18n";
import { HAND_WRITTEN_LOCALES, LOCALE_BUNDLES } from "@/test-helpers/locales";
import { renderWithTheme } from "@/test-helpers/theme";

jest.mock("react-native-reanimated", () => jest.requireActual("@/test-helpers/reanimatedMock"));
jest.mock("@gorhom/bottom-sheet", () => jest.requireActual("@/test-helpers/bottomSheetMock"));
// Jest has no font files: report the icon font as loaded.
jest.mock("expo-font", () => ({ ...jest.requireActual("expo-font"), isLoaded: () => true }));

/** Each option's label, and the hint that says where the option goes. */
const OPTIONS: readonly (readonly [ParseKeys, ParseKeys])[] = [
  ["settings.help.contact.email", "a11y.help.emailHint"],
  ["settings.help.contact.whatsapp", "a11y.help.whatsappHint"],
  ["settings.help.contact.telegram", "a11y.help.telegramHint"],
];

/** WhatsApp and Telegram appear only when the build carries their addresses. */
const CHAT_ADDRESSES = {
  EXPO_PUBLIC_WHATSAPP_NUMBER: "15550000000",
  EXPO_PUBLIC_TELEGRAM_USERNAME: "example",
};

describe("ContactUs", () => {
  // expo/virtual/env keeps this object: write onto it, never replace it.
  beforeEach(() => {
    Object.assign(process.env, CHAT_ADDRESSES);
  });

  afterEach(() => {
    Object.keys(CHAT_ADDRESSES).forEach((name) => delete process.env[name]);
  });

  it.each(OPTIONS)("tells a screen reader where %s goes", async (label, hint) => {
    await renderWithTheme(<ContactUs />);

    expect(screen.getByRole("button", { name: i18n.t(label) }).props.accessibilityHint).toBe(
      i18n.t(hint)
    );
  });
});

describe.each(HAND_WRITTEN_LOCALES)("Contact Us hints in %s", (locale) => {
  it.each(OPTIONS.map(([, hint]) => hint))("defines %s", (key) => {
    expect(LOCALE_BUNDLES[locale][key]).toEqual(expect.stringMatching(/\S/));
  });
});
