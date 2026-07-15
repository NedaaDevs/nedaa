import { forwardRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useTheme } from "tamagui";
import { Info } from "lucide-react-native";

import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";

// Generic "what's this / why" explainer. An info icon presents it via ref to show
// a title + body — reuse for any setting that needs a detail sheet.
export const InfoSheet = forwardRef<BottomSheetModal, { titleKey: string; bodyKey: string }>(
  ({ titleKey, bodyKey }, ref) => {
    const { t } = useTranslation();
    const theme = useTheme();
    const insets = useSafeAreaInsets();

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          pressBehavior="close"
        />
      ),
      []
    );

    return (
      <BottomSheetModal
        ref={ref}
        enablePanDownToClose
        enableDynamicSizing
        backdropComponent={renderBackdrop}
        backgroundStyle={{
          backgroundColor: theme.backgroundSecondary?.val ?? theme.background?.val,
        }}
        handleIndicatorStyle={{
          backgroundColor: theme.typographySecondary?.val ?? theme.outline?.val,
        }}>
        <BottomSheetScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 4,
            paddingBottom: Math.max(insets.bottom, 16) + 8,
          }}>
          <VStack gap="$4">
            <VStack gap="$1.5" alignItems="center">
              <Icon as={Info} size="lg" color="$accentPrimary" />
              <Text size="xl" fontWeight="700" color="$typography" accessibilityRole="header">
                {t(titleKey)}
              </Text>
            </VStack>
            {/* Body is authored as paragraphs split on blank lines, so it reads
                as scannable chunks rather than one dense block. */}
            <VStack gap="$3">
              {t(bodyKey)
                .split("\n\n")
                .map((paragraph, i) => (
                  <Text key={i} size="md" color="$typographySecondary" lineHeight={26}>
                    {paragraph}
                  </Text>
                ))}
            </VStack>
          </VStack>
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  }
);

InfoSheet.displayName = "InfoSheet";

export default InfoSheet;
