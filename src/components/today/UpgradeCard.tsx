import { use } from "react";
import type { AccessibilityActionEvent } from "react-native";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, X } from "lucide-react-native";

import { Box } from "@/components/ui/box";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { SkyOccluder } from "@/components/ui/sky-background";
import { usePageSky } from "@/components/ui/sky-background/useLiveSky";
import { SkySwatch } from "@/components/ui/sky-preview";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { A11Y_ACTION, HIDDEN_FROM_READER } from "@/constants/Accessibility";
import { SKY_SWATCH_SIZE } from "@/constants/Sky";
import { UPGRADE_PATH_STATE } from "@/constants/UpgradePath";
import { AlertLaunchContext } from "@/contexts/AlertLaunchContext";
import { AppMode } from "@/enums/app";
import { useAppStore } from "@/stores/app";
import { skySwatchFor } from "@/utils/sky";

/** Test ids for the card's parts. */
export const UPGRADE_CARD_PART = {
  FRAME: "upgrade-card",
  DISMISS: "upgrade-card-dismiss",
} as const;

/** Brings an upgrader who chose Later back to the V3 choices. */
export const UpgradeCard = () => {
  const { t } = useTranslation();
  const sky = usePageSky();
  const later = useAppStore((state) => state.upgradePath === UPGRADE_PATH_STATE.LATER);
  const setUpgradePath = useAppStore((state) => state.setUpgradePath);
  // An alert's launch opens no path, so the card waits for the next.
  const alertLaunch = use(AlertLaunchContext);

  if (!later || alertLaunch) return null;

  const title = t("onboarding.upgrade.title");
  const body = t("onboarding.upgrade.cardBody");
  const end = () => setUpgradePath(UPGRADE_PATH_STATE.DONE);
  const onAccessibilityAction = ({ nativeEvent }: AccessibilityActionEvent) => {
    if (nativeEvent.actionName === A11Y_ACTION.DISMISS) end();
  };

  return (
    <SkyOccluder testID={UPGRADE_CARD_PART.FRAME}>
      <Box>
        <Card.Pressable
          flexDirection="row"
          alignItems="center"
          gap="$3"
          onPress={() => setUpgradePath(UPGRADE_PATH_STATE.RESUMED)}
          accessibilityLabel={t("a11y.join", { first: title, second: body })}
          accessibilityHint={t("a11y.today.upgradeCardHint")}
          accessibilityActions={[
            { name: A11Y_ACTION.DISMISS, label: t("onboarding.upgrade.keep") },
          ]}
          onAccessibilityAction={onAccessibilityAction}>
          <SkySwatch
            bands={skySwatchFor(AppMode.ADAPTIVE)}
            hijriDay={sky.hijriDay}
            isRTL={sky.isRTL}
            size={SKY_SWATCH_SIZE.CARD}
          />
          <VStack flex={1} gap="$1">
            <Text size="sm" bold color="$fg">
              {title}
            </Text>
            <Text size="sm" color="$fg">
              {body}
            </Text>
            <Start />
          </VStack>
          {/* Room for the ✕ that sits over the card's end corner. */}
          <Box width="$target" />
        </Card.Pressable>
        <Pressable
          testID={UPGRADE_CARD_PART.DISMISS}
          onPress={end}
          position="absolute"
          top={0}
          end={0}
          alignItems="center"
          justifyContent="center"
          borderRadius="$pill"
          {...HIDDEN_FROM_READER}>
          <Icon as={X} size="sm" color="$fg" />
        </Pressable>
      </Box>
    </SkyOccluder>
  );
};

/** The card's call to action; the chevron points the way the page reads on. */
const Start = () => {
  const { t } = useTranslation();
  const { isRTL } = usePageSky();
  return (
    <HStack alignItems="center" gap="$1">
      <Text size="sm" fontWeight="600" color="$accentText">
        {t("onboarding.upgrade.start")}
      </Text>
      <Icon as={isRTL ? ChevronLeft : ChevronRight} size="xs" color="$accentText" />
    </HStack>
  );
};
