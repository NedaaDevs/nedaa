import { useTranslation } from "react-i18next";
import { ShieldCheck, Sparkles } from "lucide-react-native";

import type { StepProps } from "@/components/onboarding/flow/types";
import { WelcomeLayout } from "@/components/onboarding/flow/WelcomeLayout";
import { Button } from "@/components/ui/button";
import { ListGroup } from "@/components/ui/list-group";
import { LIST_ROW_VARIANT, ListRow } from "@/components/ui/list-row";
import { SkyOccluder } from "@/components/ui/sky-background";
import { VStack } from "@/components/ui/vstack";
import { UPGRADE_PATH_STATE } from "@/constants/UpgradePath";
import { useAppStore } from "@/stores/app";

const STRETCH = { alignSelf: "stretch" } as const;

/** A 2.x user's first page: what stays, what is new, and three ways out. */
export const UpgradeWelcomeStep = ({ onNext, headingRef, onHeadingLayout }: StepProps) => {
  const { t } = useTranslation();
  const setUpgradePath = useAppStore((state) => state.setUpgradePath);
  const start = t("onboarding.upgrade.start");
  const later = t("onboarding.upgrade.later");
  const keep = t("onboarding.upgrade.keep");

  return (
    <WelcomeLayout
      headingRef={headingRef}
      onHeadingLayout={onHeadingLayout}
      title={t("onboarding.upgrade.title")}
      body={t("onboarding.upgrade.body")}>
      <SkyOccluder style={STRETCH}>
        <ListGroup>
          <ListRow
            variant={LIST_ROW_VARIANT.GROUPED}
            icon={ShieldCheck}
            tile
            title={t("onboarding.upgrade.keptTitle")}
            status={t("onboarding.upgrade.kept")}
          />
          <ListRow
            variant={LIST_ROW_VARIANT.GROUPED}
            icon={Sparkles}
            tile
            title={t("onboarding.upgrade.newTitle")}
            status={t("onboarding.upgrade.new")}
          />
        </ListGroup>
      </SkyOccluder>

      <VStack alignSelf="stretch" gap="$2">
        <Button
          action="primary"
          variant="solid"
          size="lg"
          onPress={onNext}
          accessibilityRole="button"
          accessibilityLabel={start}>
          <Button.Text fontWeight="500">{start}</Button.Text>
        </Button>
        <Button
          action="secondary"
          variant="outline"
          size="lg"
          onPress={() => setUpgradePath(UPGRADE_PATH_STATE.LATER)}
          accessibilityRole="button"
          accessibilityLabel={later}
          accessibilityHint={t("a11y.onboarding.upgradeLaterHint")}>
          <Button.Text>{later}</Button.Text>
        </Button>
        <SkyOccluder>
          <Button
            action="primary"
            variant="link"
            onPress={() => setUpgradePath(UPGRADE_PATH_STATE.DONE)}
            accessibilityRole="button"
            accessibilityLabel={keep}
            accessibilityHint={t("a11y.onboarding.upgradeKeepHint")}>
            <Button.Text>{keep}</Button.Text>
          </Button>
        </SkyOccluder>
      </VStack>
    </WelcomeLayout>
  );
};
