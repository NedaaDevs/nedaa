import { screen } from "@testing-library/react-native";
import type { ParseKeys } from "i18next";

import i18n from "@/localization/i18n";

/** Fails unless `key`'s copy is on screen and contains `titleKey`'s. */
export const expectCopyNaming = (key: ParseKeys, titleKey: ParseKeys) => {
  const copy = i18n.t(key);
  expect(screen.getByText(copy)).toBeTruthy();
  expect(copy).toContain(i18n.t(titleKey));
};
