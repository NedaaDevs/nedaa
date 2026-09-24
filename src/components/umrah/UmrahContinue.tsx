import { useTranslation } from "react-i18next";
import { router } from "expo-router";

import { HStack } from "@/components/ui/hstack";
import { Meter } from "@/components/ui/meter";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { BACK_DESTINATION } from "@/constants/BackDestinations";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { useUmrahGuideStore } from "@/stores/umrahGuide";
import { localizeDigits } from "@/utils/digits";

/** An Umrah under way: how far it has come, and the step that comes next. */
export const UmrahContinue = () => {
  const { t } = useTranslation();
  const active = useUmrahGuideStore((state) => state.activeProgress);
  // Called inside the selectors so they re-run on every store change.
  const completed = useUmrahGuideStore((state) => state.getOverallProgress().completed);
  const total = useUmrahGuideStore((state) => state.getOverallProgress().total);
  const stepKey = useUmrahGuideStore((state) => state.getCurrentStep()?.titleKey);
  const locale = useAppStore((state) => state.locale);
  const western = usePreferencesStore((state) => state.useWesternNumerals);

  if (!active || !stepKey) return null;

  const title = t("tools.umrah.continue");
  // No spaces round the slash: with them, right-to-left text reverses the pair.
  const done = t("tools.umrah.done", {
    progress: localizeDigits(`${completed}/${total}`, locale, western),
  });
  const next = t("tools.umrah.nextStep", { step: t(stepKey) });

  return (
    <Pressable
      onPress={() => router.push(BACK_DESTINATION.UMRAH.href)}
      accessibilityLabel={`${title}, ${done}, ${next}`}
      accessibilityHint={t("a11y.tools.continueHint")}
      padding="$3"
      gap="$2"
      borderWidth={1}
      borderColor="$border"
      borderRadius="$card"
      backgroundColor="$surface2">
      <HStack alignItems="center" justifyContent="space-between" gap="$2.5">
        <Text size="sm" bold color="$fg">
          {title}
        </Text>
        <Text size="xs" color="$muted">
          {done}
        </Text>
      </HStack>
      <Meter value={completed} max={total} label={t("a11y.tools.umrahProgress")} />
      <Text size="xs" color="$muted">
        {next}
      </Text>
    </Pressable>
  );
};
