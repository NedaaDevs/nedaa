import { AccessibilityInfo, Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { useIsFocused, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ATHKAR_LOOKS } from "@/components/athkar/looks/registry";
import { Box } from "@/components/ui/box";
import { Button } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { Material, MATERIAL } from "@/components/ui/material";
import { useBackDestination } from "@/components/ui/screen-header/useBackDestination";
import { SegmentedChoice } from "@/components/ui/segmented-choice";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { ATHKAR_LOOK_IDS, type AthkarLookId } from "@/constants/AthkarLook";
import { CHOOSER_MODE } from "@/constants/AthkarLookChooser";
import { E2E_ID } from "@/constants/E2E";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { PlatformType } from "@/enums/app";
import type { AthkarLookChooser } from "@/hooks/useAthkarLookChooser";
import { useCoverTabBar } from "@/hooks/useCoverTabBar";
import { useTabBarInset } from "@/hooks/useTabBarInset";
import { tabBarEdgeGap } from "@/utils/safeArea";

type LookDockProps = { chooser: AthkarLookChooser };

/** The chooser's bar under the reader: the looks, and the button that keeps one. */
export const LookDock = ({ chooser }: LookDockProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarInset = useTabBarInset();
  const focused = useIsFocused();
  const first = chooser.mode === CHOOSER_MODE.FIRST;
  // On a first visit the dock sits where the tab bar's pill was.
  useCoverTabBar(first && focused);

  // A chooser opened with no screen behind it leaves for Athkar.
  const behind = useBackDestination();
  const leave = () => {
    if (behind) router.back();
    else router.navigate(BACK_DESTINATION.ATHKAR.href);
  };

  const nameOf = (look: AthkarLookId) => t(ATHKAR_LOOKS[look].name);

  const confirm = () => {
    chooser.confirm();
    AccessibilityInfo.announceForAccessibility(
      t("a11y.athkar.lookChosen", { name: nameOf(chooser.look) })
    );
    if (!first) leave();
  };

  return (
    <Box
      marginHorizontal="$2.5"
      marginBottom={
        tabBarInset +
        tabBarEdgeGap({
          android: Platform.OS === PlatformType.ANDROID,
          insetBottom: insets.bottom,
        })
      }>
      <Material material={MATERIAL.FLOAT} radius="$hero">
        <VStack gap="$2.5" paddingHorizontal="$3" paddingTop="$3" paddingBottom="$2.5">
          <Text
            size="label"
            fontWeight="600"
            color="$fg"
            textAlign="center"
            accessibilityRole="header">
            {t("athkar.look.choose")}
          </Text>
          <SegmentedChoice
            options={ATHKAR_LOOK_IDS}
            value={chooser.look}
            onChange={chooser.pick}
            accessibilityLabel={t("athkar.look.title")}
            label={nameOf}
          />
          <HStack alignItems="center" gap="$1">
            <Button flex={1} action="primary" testID={E2E_ID.ATHKAR_LOOK_USE} onPress={confirm}>
              <Button.Text>{t("athkar.look.use")}</Button.Text>
            </Button>
            {first ? null : (
              <Button action="primary" variant="link" onPress={leave}>
                <Button.Text>{t("common.back")}</Button.Text>
              </Button>
            )}
          </HStack>
          <Text size="helper" fontWeight="500" color="$muted" textAlign="center">
            {first
              ? t("athkar.look.changeLater")
              : t("athkar.look.current", { name: nameOf(chooser.current) })}
          </Text>
        </VStack>
      </Material>
    </Box>
  );
};
