import type { ComponentProps } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { getTokenValue } from "tamagui";
import {
  BottomSheetBackdrop,
  BottomSheetHandle,
  type BottomSheetBackdropProps,
  type BottomSheetBackgroundProps,
  type BottomSheetModalProps,
} from "@gorhom/bottom-sheet";

/** Test ids for the parts the app draws in place of gorhom's own. */
export const SHEET_CHROME_PART = { BACKGROUND: "sheet-background" } as const;

// gorhom groups its content into one "Bottom Sheet" element by default.
export const UNGROUPED_CONTENT = {
  accessible: false,
  accessibilityLabel: null,
  accessibilityRole: null,
} as const satisfies Partial<BottomSheetModalProps>;

/** The surface in backgroundStyle's colour, silent, rounded at $sheet. */
export const SheetBackground = ({ pointerEvents, style }: BottomSheetBackgroundProps) => (
  <View
    testID={SHEET_CHROME_PART.BACKGROUND}
    pointerEvents={pointerEvents}
    style={[style, { borderRadius: getTokenValue("$sheet", "radius") }]}
  />
);

/** gorhom's handle without its English label, hint and role. */
export const SilentHandle = (props: ComponentProps<typeof BottomSheetHandle>) => (
  <BottomSheetHandle
    {...props}
    accessible={false}
    accessibilityLabel={null}
    accessibilityHint={null}
    accessibilityRole={null}
  />
);

/** gorhom's backdrop, closing the sheet, named in the app's language. */
export const DismissBackdrop = (props: BottomSheetBackdropProps) => {
  const { t } = useTranslation();
  return (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      pressBehavior="close"
      accessibilityLabel={t("a11y.dismiss")}
      // An empty hint makes gorhom speak its own English one.
      accessibilityHint={t("a11y.sheet.dismissHint")}
    />
  );
};
