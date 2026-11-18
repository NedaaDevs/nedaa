import type { ReactNode } from "react";
import { FontLanguage } from "tamagui";

import type { FontLanguageName } from "@/constants/Fonts";

/** Sets the text inside in one script's face, whatever the app's language. */
export const Face = ({
  language,
  children,
}: {
  language: FontLanguageName;
  children: ReactNode;
}) => (
  <FontLanguage body={language} heading={language}>
    {children}
  </FontLanguage>
);
