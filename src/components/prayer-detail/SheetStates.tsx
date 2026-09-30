import { useTranslation } from "react-i18next";
import { parseISO } from "date-fns";

import { ActionsheetTitle } from "@/components/ui/actionsheet";
import { StatePanel } from "@/components/ui/state-panel";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { PRAYER_ID, type PrayerId } from "@/constants/Prayer";
import { STATE_PANEL_KIND, type StatePanelKind } from "@/constants/StatePanel";
import { useShownDay } from "@/hooks/useShownDay";
import { prayerNameKey } from "@/utils/prayerName";
import { isFridayInTimeZone } from "@/utils/weekdayTimeZone";

const COPY = {
  [STATE_PANEL_KIND.LOADING]: {
    title: "prayerDetail.states.loading.title",
    body: "prayerDetail.states.loading.body",
  },
  [STATE_PANEL_KIND.UNAVAILABLE]: {
    title: "prayerDetail.states.unavailable.title",
    body: "prayerDetail.states.unavailable.body",
  },
  [STATE_PANEL_KIND.ERROR]: {
    title: "prayerDetail.states.error.title",
    body: "prayerDetail.states.error.body",
  },
} as const satisfies Record<StatePanelKind, { title: string; body: string }>;

type StateProps = { prayerId: PrayerId; kind: StatePanelKind; onRetry?: () => void };

/** The chosen prayer named above a state panel; reader focus lands on it. */
const SheetState = ({ prayerId, kind, onRetry }: StateProps) => {
  const { t } = useTranslation();
  const { day } = useShownDay();
  // Jumu'ah only when the stored day says Friday; with no day, the plain name.
  const dhuhr = day?.timings[PRAYER_ID.DHUHR];
  const friday = !!day && !!dhuhr && isFridayInTimeZone(parseISO(dhuhr), day.timezone);
  const prayer = t(prayerNameKey(prayerId, friday));

  return (
    <VStack gap="$3">
      <ActionsheetTitle>
        <Text size="xl" bold color="$fg">
          {prayer}
        </Text>
      </ActionsheetTitle>
      <StatePanel
        kind={kind}
        title={t(COPY[kind].title)}
        body={t(COPY[kind].body, { prayer })}
        action={
          onRetry && {
            label: t("common.retry"),
            hint: t("a11y.prayerDetail.states.retry"),
            onPress: onRetry,
          }
        }
      />
    </VStack>
  );
};

type Props = { prayerId: PrayerId };
type RetryProps = Props & { onRetry: () => void };

/** The prayer's settings on their way. */
export const SheetLoadingState = ({ prayerId }: Props) => (
  <SheetState prayerId={prayerId} kind={STATE_PANEL_KIND.LOADING} />
);

/** No time is stored for the prayer, and nothing is loading one. */
export const SheetUnavailableState = ({ prayerId, onRetry }: RetryProps) => (
  <SheetState prayerId={prayerId} kind={STATE_PANEL_KIND.UNAVAILABLE} onRetry={onRetry} />
);

/** Loading the prayer's time failed. */
export const SheetErrorState = ({ prayerId, onRetry }: RetryProps) => (
  <SheetState prayerId={prayerId} kind={STATE_PANEL_KIND.ERROR} onRetry={onRetry} />
);
