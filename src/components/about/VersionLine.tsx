import { useRef } from "react";
import { useTranslation } from "react-i18next";

import { PILL_TONE, Pill } from "@/components/ui/pill";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { APP_NAME_LATIN } from "@/constants/App";
import { DEBUG_COPY } from "@/constants/DebugScreens";
import { useHaptic } from "@/hooks/useHaptic";
import { useDebugModeStore } from "@/stores/debugMode";
import { appVersionLabel } from "@/utils/appVersion";
import { LTR_ISOLATE } from "@/utils/digits";

const SECRET_TAP_COUNT = 7;
const TAP_WINDOW_MS = 3000;

/** The version and build; seven quick taps turn debug mode on or off. */
export const VersionLine = () => {
  const { t } = useTranslation();
  const isDebugEnabled = useDebugModeStore((s) => s.isEnabled);
  const toggleDebugMode = useDebugModeStore((s) => s.toggle);
  const hapticSuccess = useHaptic("success");
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
    // With the parent's gap, 24 above: the study's space before the version.
    <VStack alignItems="center" gap="$2" paddingTop="$1">
      {/* A hidden gesture, not a control: no button role and no hint. */}
      <Pressable
        onPress={handleTap}
        accessibilityRole="text"
        accessibilityLabel={t("a11y.about.version", { version: label })}
        justifyContent="center"
        paddingHorizontal="$3">
        {/* A Latin identifier in every language, isolated so RTL cannot reorder it. */}
        <Text size="sm" color="$muted" textAlign="center">
          {`${LTR_ISOLATE.OPEN}${APP_NAME_LATIN} · ${label}${LTR_ISOLATE.CLOSE}`}
        </Text>
      </Pressable>
      {isDebugEnabled ? <Pill tone={PILL_TONE.WARN}>{DEBUG_COPY.ON}</Pill> : null}
    </VStack>
  );
};
