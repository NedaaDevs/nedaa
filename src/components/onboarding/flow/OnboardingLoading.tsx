import { useTranslation } from "react-i18next";

import { BrandIcon } from "@/components/ui/brand-icon";
import { Spinner } from "@/components/ui/spinner";
import { VStack } from "@/components/ui/vstack";
import { ONBOARDING_PART } from "@/constants/Onboarding";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const BUSY = { busy: true } as const;

/** What the flow shows while it reads the device: the icon over a spinner. */
export const OnboardingLoading = () => {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  return (
    <VStack flex={1} alignItems="center" justifyContent="center">
      <VStack
        testID={ONBOARDING_PART.LOADING}
        alignItems="center"
        gap="$5"
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t("onboarding.loading")}
        accessibilityState={BUSY}>
        <BrandIcon size="$24" />
        {/* Reduce Motion keeps the icon alone: a spinner only moves. */}
        {reduced ? null : (
          <Spinner testID={ONBOARDING_PART.LOADING_SPINNER} size="small" color="$mutedSky" />
        )}
      </VStack>
    </VStack>
  );
};
