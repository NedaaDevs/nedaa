import { useState, type RefObject } from "react";
import type { HostInstance } from "react-native";
import { useTranslation } from "react-i18next";
import { parseISO } from "date-fns";
import { X } from "lucide-react-native";

import { Actionsheet, ActionsheetContent, ActionsheetTitle } from "@/components/ui/actionsheet";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { PRAYER_ID, type PrayerId } from "@/constants/Prayer";
import { useShownDay } from "@/hooks/useShownDay";
import { SimulatedClockContext, useClockOverride } from "@/hooks/useTodayClock";
import { prayerNameKey } from "@/utils/prayerName";
import { isFridayInTimeZone } from "@/utils/weekdayTimeZone";

type Props = {
  /** The prayer to show; none closes the sheet. */
  prayerId?: PrayerId;
  onClose: () => void;
  finalFocusRef?: RefObject<HostInstance | null>;
};

type Opening = {
  /** The prayer last passed in, open or not. */
  requested?: PrayerId;
  /** The prayer the body shows; it stays while the sheet slides away. */
  shown?: PrayerId;
  /** Counts openings, so each one starts the body afresh. */
  count: number;
};

type BodyProps = { prayerId: PrayerId; onClose: () => void };

/** The prayer's name as the sheet's title, under its close button. */
const PrayerDetailBody = ({ prayerId, onClose }: BodyProps) => {
  const { t } = useTranslation();
  const { day } = useShownDay();
  const friday =
    day !== null && isFridayInTimeZone(parseISO(day.timings[PRAYER_ID.DHUHR]), day.timezone);

  return (
    <VStack gap="$5" paddingBottom="$5">
      <HStack justifyContent="flex-end">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.close")}
          onPress={onClose}
          alignItems="center"
          justifyContent="center"
          borderRadius="$pill">
          <Icon as={X} size="md" color="$muted" />
        </Pressable>
      </HStack>
      <ActionsheetTitle>
        <Text size="2xl" bold typography="title" color="$fg">
          {t(prayerNameKey(prayerId, friday))}
        </Text>
      </ActionsheetTitle>
    </VStack>
  );
};

/** One prayer's alerts and details, opened from its card on Today. */
export const PrayerDetailSheet = ({ prayerId, onClose, finalFocusRef }: Props) => {
  // gorhom renders the body in a portal, outside Today's simulated clock.
  const clock = useClockOverride();
  const [opening, setOpening] = useState<Opening>({ count: 0 });
  if (prayerId !== opening.requested) {
    setOpening({
      requested: prayerId,
      shown: prayerId ?? opening.shown,
      count: prayerId === undefined ? opening.count : opening.count + 1,
    });
  }

  return (
    <Actionsheet
      isOpen={prayerId !== undefined}
      onClose={onClose}
      fitContent
      finalFocusRef={finalFocusRef}>
      <ActionsheetContent>
        <SimulatedClockContext value={clock}>
          {opening.shown ? (
            <PrayerDetailBody key={opening.count} prayerId={opening.shown} onClose={onClose} />
          ) : null}
        </SimulatedClockContext>
      </ActionsheetContent>
    </Actionsheet>
  );
};
