import { useRef } from "react";
import type { ViewInstance } from "react-native";
import { useTranslation } from "react-i18next";
import { parseISO } from "date-fns";

import { PRAYER_ICONS } from "@/components/today/prayerIcons";
import { Box } from "@/components/ui/box";
import { Grid } from "@/components/ui/grid";
import { HStack } from "@/components/ui/hstack";
import { Icon } from "@/components/ui/icon";
import { HighlightEdge } from "@/components/ui/material/edge";
import { Pressable } from "@/components/ui/pressable";
import { usePressScale } from "@/components/ui/pressable/pressScale";
import { Text } from "@/components/ui/text";
import { useThemeColor } from "@/components/ui/theme-color";
import { accentGlowShadow } from "@/constants/Elevation";
import { PRAYER_CARD_STATE, PRAYER_CELL_HEIGHT } from "@/constants/PrayerCard";
import { OTHER_TIMING, PRAYER_ID, type PrayerId } from "@/constants/Prayer";
import { useShownDay } from "@/hooks/useShownDay";
import { useAppStore } from "@/stores/app";
import { usePreferencesStore } from "@/stores/preferences";
import { formatPrayerTime } from "@/utils/date";
import { localizeDigits } from "@/utils/digits";
import { prayerCards, type PrayerCard } from "@/utils/prayerCards";
import { prayerNameKey } from "@/utils/prayerName";
import { spokenClockTime } from "@/utils/spokenClockTime";
import { isFridayInTimeZone } from "@/utils/weekdayTimeZone";

export const PRAYER_GRID_PART = {
  SUNRISE: "prayer-grid-sunrise",
  RING: "prayer-grid-ring",
} as const;

type CardProps = {
  card: PrayerCard;
  name: string;
  time: string;
  spoken: string;
  selected: boolean;
  onPress: (opener: ViewInstance | null) => void;
};

/** One prayer on one line: quiet, or tinted, ringed and glowing when next. */
const PrayerCardView = ({ card, name, time, spoken, selected, onPress }: CardProps) => {
  const { t } = useTranslation();
  // Held from mount: a ref handed over later is never attached.
  const self = useRef<ViewInstance>(null);
  const press = usePressScale();
  const glow = accentGlowShadow(useThemeColor("$accentGlow"));
  const current = card.state === PRAYER_CARD_STATE.CURRENT;
  // The one lit card: the prayer just come in, else the next.
  const next = current || card.state === PRAYER_CARD_STATE.NEXT;
  const past = card.state === PRAYER_CARD_STATE.PAST;

  return (
    <Pressable
      ref={self}
      onPress={() => onPress(self.current)}
      // The state shows only as colour on screen, so the label carries it.
      accessibilityLabel={t(
        current
          ? "a11y.today.prayerCardCurrent"
          : next
            ? "a11y.today.prayerCardNext"
            : "a11y.today.prayerCard",
        {
          prayer: name,
          time: spoken,
        }
      )}
      accessibilityHint={t("a11y.today.prayerCardHint")}
      accessibilityState={{ selected }}
      transition={press.transition}
      animateOnly={press.animateOnly}
      pressStyle={press.pressStyle}
      flexDirection="row"
      alignItems="center"
      gap="$2.5"
      minHeight={PRAYER_CELL_HEIGHT}
      paddingHorizontal="$3.5"
      paddingVertical="$2.5"
      borderRadius="$card"
      backgroundColor={next ? "$accentSoft" : "$surfaceQuiet"}
      style={next ? { boxShadow: glow } : undefined}>
      <HighlightEdge radius="card" />
      {/* Drawn over the card, so a ring moves nothing; the chosen ring wins. */}
      {selected || next ? (
        <Box
          testID={PRAYER_GRID_PART.RING}
          position="absolute"
          top={0}
          bottom={0}
          start={0}
          end={0}
          pointerEvents="none"
          borderRadius="$card"
          borderWidth={selected ? 2 : 1}
          borderColor={selected ? "$accent" : "$accentRing"}
        />
      ) : null}
      <Box opacity={past ? 0.6 : 1}>
        <Icon as={PRAYER_ICONS[card.id]} size="md" color={next ? "$accent" : "$muted"} />
      </Box>
      {/* A long name wraps and the card grows; the time stays whole. */}
      <Text size="md" fontWeight="600" flexShrink={1} color={past ? "$mutedSky" : "$fg"}>
        {name}
      </Text>
      <Text
        size="label"
        fontWeight="600"
        numeric
        flexShrink={0}
        marginStart="auto"
        color={past ? "$mutedSky" : "$fg"}>
        {time}
      </Text>
    </Pressable>
  );
};

type Props = {
  /** The prayer chosen on Today, ringed here and lit on the day's arc. */
  selected?: PrayerId;
  /** Gets the pressed card too, where reader focus returns after its sheet. */
  onSelect: (id: PrayerId, opener: ViewInstance | null) => void;
  /** Only the leading prayer's card, across the row, as a short preview. */
  nextOnly?: boolean;
};

/** The day's five prayers in equal cells, and sunrise quiet in the sixth. */
export const PrayerGrid = ({ selected, onSelect, nextOnly = false }: Props) => {
  const { t } = useTranslation();
  const { now, day, following } = useShownDay();
  const locale = useAppStore((state) => state.locale);
  const use24HourTime = usePreferencesStore((state) => state.use24HourTime);
  const western = usePreferencesStore((state) => state.useWesternNumerals);

  if (!day) return null;

  const { lead, cards } = prayerCards(day, now, following);
  const friday = isFridayInTimeZone(parseISO(day.timings[PRAYER_ID.DHUHR]), day.timezone);
  const shown = (time: string) =>
    localizeDigits(
      formatPrayerTime(time, day.timezone, { locale, use24HourTime }),
      locale,
      western
    );
  const spoken = (time: string) =>
    spokenClockTime(time, day.timezone, { locale, use24HourTime, western }, t);
  const sunrise = day.otherTimings[OTHER_TIMING.SUNRISE];
  const sunriseName = t("otherTimings.sunrise");

  return (
    <Grid columns={2} gap="$2.5">
      {(nextOnly ? [lead] : cards).map((card) => (
        <Grid.Item key={card.id} wide={nextOnly}>
          <PrayerCardView
            card={card}
            name={t(prayerNameKey(card.id, friday))}
            time={shown(card.time)}
            spoken={spoken(card.time)}
            selected={card.id === selected}
            onPress={(opener) => onSelect(card.id, opener)}
          />
        </Grid.Item>
      ))}
      {nextOnly ? null : (
        <Grid.Item key={OTHER_TIMING.SUNRISE}>
          <HStack
            testID={PRAYER_GRID_PART.SUNRISE}
            accessible
            accessibilityLabel={t("a11y.today.prayerCard", {
              prayer: sunriseName,
              time: spoken(sunrise),
            })}
            alignItems="center"
            gap="$1.5"
            minHeight={PRAYER_CELL_HEIGHT}
            paddingHorizontal="$2.5">
            <Box opacity={0.8}>
              <Icon as={PRAYER_ICONS[OTHER_TIMING.SUNRISE]} size="sm" color="$mutedSky" />
            </Box>
            <Text size="helper" fontWeight="500" flexShrink={1} color="$mutedSky">
              {sunriseName}
            </Text>
            <Text
              size="md"
              fontWeight="500"
              numeric
              flexShrink={0}
              marginStart="auto"
              color="$mutedSky">
              {shown(sunrise)}
            </Text>
          </HStack>
        </Grid.Item>
      )}
    </Grid>
  );
};
