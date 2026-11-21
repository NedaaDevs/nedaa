import { useTranslation } from "react-i18next";

import { SegmentedChoice } from "@/components/ui/segmented-choice";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import {
  EMERGENCY_QUIET_ALLOWANCE,
  EMERGENCY_QUIET_ALLOWANCES,
  EMERGENCY_QUIET_MINUTES,
  EMERGENCY_QUIET_PART,
  type EmergencyQuietAllowance,
} from "@/constants/EmergencyQuiet";
import { useDayMonth } from "@/hooks/useDayMonth";
import { useMinuteClock } from "@/hooks/useMinuteClock";
import { useEmergencyQuietStore } from "@/stores/emergencyQuiet";
import {
  allowanceInEffect,
  chosenAllowance,
  raiseStartsOn,
  usesLeft,
} from "@/utils/emergencyQuiet";

const { OFF } = EMERGENCY_QUIET_ALLOWANCE;

/** The emergency quiets a month that every alarm shares, and those left. */
const EmergencyQuietSettings = () => {
  const { t } = useTranslation();
  const now = useMinuteClock().getTime();
  const ledger = useEmergencyQuietStore((state) => state.ledger);
  const setAllowance = useEmergencyQuietStore((state) => state.setAllowance);
  const dayMonth = useDayMonth();
  const raise = raiseStartsOn(ledger, now);
  const off = t("common.off");

  return (
    <VStack gap="$2">
      <SegmentedChoice<EmergencyQuietAllowance>
        options={EMERGENCY_QUIET_ALLOWANCES}
        value={chosenAllowance(ledger, now)}
        onChange={(allowance) => setAllowance(allowance, Date.now())}
        accessibilityLabel={t("alarm.quiet.settings.title")}
        label={(allowance) => (allowance === OFF ? off : String(allowance))}
        spokenLabel={(allowance) =>
          allowance === OFF ? off : t("a11y.alarm.quiet.perMonth", { count: allowance })
        }
      />
      {allowanceInEffect(ledger, now) !== OFF && (
        <Text testID={EMERGENCY_QUIET_PART.LEFT} size="sm" fontWeight="600" color="$typography">
          {t("alarm.quiet.settings.left", { count: usesLeft(ledger, now) })}
        </Text>
      )}
      {raise && (
        <Text testID={EMERGENCY_QUIET_PART.RAISED} size="sm" color="$typography">
          {t("alarm.quiet.settings.raised", { date: dayMonth(raise) })}
        </Text>
      )}
      <Text size="sm" color="$typographySecondary">
        {t("alarm.quiet.settings.help", { count: EMERGENCY_QUIET_MINUTES })}
      </Text>
    </VStack>
  );
};

export default EmergencyQuietSettings;
