import { useRef } from "react";
import { useTranslation } from "react-i18next";

import { PILL_TONE, Pill } from "@/components/ui/pill";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { APP_NAME_LATIN } from "@/constants/App";
import { DEBUG_COPY } from "@/constants/DebugScreens";
import { useHaptic } from "@/hooks/useHaptic";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import { useDebugModeStore } from "@/stores/debugMode";
import { appVersionLabel } from "@/utils/appVersion";
import { LTR_ISOLATE } from "@/utils/digits";

/** Quick taps on the version that turn debug mode on or off. */
export const SECRET_TAP_COUNT = 7;
const TAP_WINDOW_MS = 3000;

/** The version in Latin, isolated so RTL cannot reorder it. */
const VersionText = ({ label }: { label: string }) => (
  <Text size="sm" color="$muted" textAlign="center">
    {`${LTR_ISOLATE.OPEN}${APP_NAME_LATIN} · ${label}${LTR_ISOLATE.CLOSE}`}
  </Text>
);

/** The version and build, read as one line. */
export const VersionLine = () => {
  const { t } = useTranslation();
  const label = appVersionLabel();

  return (
    <VStack
      alignItems="center"
      accessible
      accessibilityRole="text"
      accessibilityLabel={t("a11y.about.version", { version: label })}>
      <VersionText label={label} />
    </VStack>
  );
};

/** The version line; seven quick taps turn debug mode on or off. */
export const DebugVersionLine = () => {
  const { t } = useTranslation();
  const isDebugEnabled = useDebugModeStore((s) => s.isEnabled);
  const toggleDebugMode = useDebugModeStore((s) => s.toggle);
  const hapticSuccess = useHaptic(HAPTIC_FEEDBACK.SUCCESS);
  const taps = useRef({ count: 0, last: 0 });

  const label = appVersionLabel();

  const handleTap = () => {
    const now = Date.now();
    const count = now - taps.current.last > TAP_WINDOW_MS ? 1 : taps.current.count + 1;
    taps.current = { count: count >= SECRET_TAP_COUNT ? 0 : count, last: now };
    if (count < SECRET_TAP_COUNT) return;
    hapticSuccess();
    toggleDebugMode();
  };

  return (
    <VStack alignItems="center" gap="$2">
      {/* A hidden gesture, not a control: no button role and no hint. */}
      <Pressable
        onPress={handleTap}
        accessibilityRole="text"
        accessibilityLabel={t("a11y.about.version", { version: label })}
        justifyContent="center"
        paddingHorizontal="$3">
        <VersionText label={label} />
      </Pressable>
      {isDebugEnabled ? <Pill tone={PILL_TONE.WARN}>{DEBUG_COPY.ON}</Pill> : null}
    </VStack>
  );
};
