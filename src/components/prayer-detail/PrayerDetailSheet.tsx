import { useState, type RefObject } from "react";
import type { HostInstance } from "react-native";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react-native";

import { AdjustmentRow } from "@/components/prayer-detail/AdjustmentRow";
import { AlarmDisclosure } from "@/components/prayer-detail/AlarmDisclosure";
import { AlertsHeader } from "@/components/prayer-detail/AlertsHeader";
import { AthanGroup } from "@/components/prayer-detail/AthanGroup";
import { IqamaGroup } from "@/components/prayer-detail/IqamaGroup";
import { PreAthanGroup } from "@/components/prayer-detail/PreAthanGroup";
import { PlaybackRow } from "@/components/prayer-detail/PlaybackRow";
import { PrayerDetailHero } from "@/components/prayer-detail/PrayerDetailHero";
import {
  SheetErrorState,
  SheetLoadingState,
  SheetUnavailableState,
} from "@/components/prayer-detail/SheetStates";
import { Actionsheet, ActionsheetContent } from "@/components/ui/actionsheet";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { Pressable } from "@/components/ui/pressable";
import { Section } from "@/components/ui/section";
import { VStack } from "@/components/ui/vstack";
import { PRAYER_DETAIL_STATE } from "@/constants/PrayerDetail";
import type { PrayerId } from "@/constants/Prayer";
import { useAlarmTypeFor } from "@/hooks/useAlarmTypeFor";
import { useNotificationSettingsHydrated } from "@/hooks/useNotificationSettingsHydrated";
import { useRetryPrayerTimes } from "@/hooks/useRetryPrayerTimes";
import { useShownDay } from "@/hooks/useShownDay";
import { SimulatedClockContext, useClockOverride } from "@/hooks/useTodayClock";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { prayerDetailState } from "@/utils/prayerDetailState";

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

/** The prayer's sections, or the state that stands in for them. */
const PrayerDetailBody = ({ prayerId, onClose }: BodyProps) => {
  const { t } = useTranslation();
  const { day } = useShownDay();
  const isLoading = usePrayerTimesStore((state) => state.isLoading);
  const hasError = usePrayerTimesStore((state) => state.hasError);
  const settingsHydrated = useNotificationSettingsHydrated();
  const alarmType = useAlarmTypeFor(prayerId);
  const state = prayerDetailState({ prayerId, day, isLoading, hasError, settingsHydrated });
  const retry = useRetryPrayerTimes();

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
      {state === PRAYER_DETAIL_STATE.READY ? (
        <>
          <PrayerDetailHero prayerId={prayerId} />
          <Section title={t("prayerDetail.sections.alerts")}>
            <AthanGroup prayerId={prayerId} />
            <IqamaGroup prayerId={prayerId} />
            <PreAthanGroup prayerId={prayerId} />
            <AlertsHeader prayerId={prayerId} />
          </Section>
          {alarmType ? (
            <Section title={t("prayerDetail.sections.alarms")}>
              <AlarmDisclosure type={alarmType} />
            </Section>
          ) : null}
          <PlaybackRow />
          <Section title={t("prayerDetail.sections.calculation")}>
            <AdjustmentRow prayerId={prayerId} />
          </Section>
        </>
      ) : state === PRAYER_DETAIL_STATE.LOADING ? (
        <SheetLoadingState prayerId={prayerId} />
      ) : state === PRAYER_DETAIL_STATE.UNAVAILABLE ? (
        <SheetUnavailableState prayerId={prayerId} onRetry={retry} />
      ) : (
        <SheetErrorState prayerId={prayerId} onRetry={retry} />
      )}
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
