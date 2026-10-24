import { useRef } from "react";
import type { ViewInstance } from "react-native";
import { useTranslation } from "react-i18next";
import { parseISO } from "date-fns";

import { PRAYER_ICONS } from "@/components/today/prayerIcons";
import { Box } from "@/components/ui/box";
import { Grid } from "@/components/ui/grid";
import { HStack } from "@/components/ui/hstack";
import { Icon, type IconProps } from "@/components/ui/icon";
import { HighlightEdge } from "@/components/ui/material/edge";
import { Pressable } from "@/components/ui/pressable";
import { usePressScale } from "@/components/ui/pressable/pressScale";
import { Text } from "@/components/ui/text";
import { useThemeColor } from "@/components/ui/theme-color";
import { VStack } from "@/components/ui/vstack";
import { accentGlowShadow } from "@/constants/Elevation";
import {
  PRAYER_BAR_HEIGHT,
  PRAYER_BAR_INSET,
  PRAYER_CARD_STATE,
  PRAYER_CELL_HEIGHT,
} from "@/constants/PrayerCard";
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
  SUNRISE_ICON: "prayer-grid-sunrise-icon",
  RING: "prayer-grid-ring",
  BAR: "prayer-grid-bar",
  BAR_FILL: "prayer-grid-bar-fill",
} as const;

type CardProps = {
  card: PrayerCard;
  name: string;
  time: string;
  spoken: string;
  selected: boolean;
  /** The share of the way to the next prayer, drawn as a bar when lit. */
  progress: number | null;
  onPress: (opener: ViewInstance | null) => void;
};

/** A thin bar along the card's lower edge, filling from the last prayer. */
const ProgressBar = ({ share }: { share: number }) => (
  <Box
    testID={PRAYER_GRID_PART.BAR}
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants"
    position="absolute"
    start="$3.5"
    end="$3.5"
    bottom={PRAYER_BAR_INSET}
    height={PRAYER_BAR_HEIGHT}
    borderRadius="$pill"
    overflow="hidden"
    backgroundColor="$track">
    <Box
      testID={PRAYER_GRID_PART.BAR_FILL}
      height="100%"
      width={`${share * 100}%`}
      borderRadius="$pill"
      backgroundColor="$accent"
    />
  </Box>
);

/** The frame every cell shares: a card's room, surface edge and shape. */
const CARD_FRAME = {
  flexDirection: "row",
  alignItems: "center",
  gap: "$2.5",
  minHeight: PRAYER_CELL_HEIGHT,
  paddingHorizontal: "$3.5",
  paddingVertical: "$2",
  borderRadius: "$card",
} as const;

type FaceProps = {
  icon: IconProps["as"];
  name: string;
  time: string;
  lit: boolean;
  past: boolean;
  iconTestID?: string;
};

/** A card's inside: the edge, its icon, and its name stacked over its time. */
const CardFace = ({ icon, name, time, lit, past, iconTestID }: FaceProps) => (
  <>
    <HighlightEdge radius="card" />
    <Box testID={iconTestID} opacity={past ? 0.6 : 1}>
      <Icon as={icon} size="md" color={lit ? "$accent" : "$muted"} />
    </Box>
    {/* Stacked, so a half-width cell fits any name beside its time. */}
    <VStack flex={1}>
      <Text size="md" fontWeight="600" color={past ? "$mutedSky" : "$fg"}>
        {name}
      </Text>
      <Text size="label" fontWeight="600" numeric color={past ? "$mutedSky" : "$fg"}>
        {time}
      </Text>
    </VStack>
  </>
);

/** One prayer, name over time: quiet, or tinted, ringed and lit when next. */
const PrayerCardView = ({ card, name, time, spoken, selected, progress, onPress }: CardProps) => {
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
      {...CARD_FRAME}
      backgroundColor={next ? "$accentSoft" : "$surfaceQuiet"}
      style={next ? { boxShadow: glow } : undefined}>
      <CardFace icon={PRAYER_ICONS[card.id]} name={name} time={time} lit={next} past={past} />
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
      {next && progress !== null ? <ProgressBar share={progress} /> : null}
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
  /** A bar in the lit card, filling from the last prayer to the next. */
  progress?: boolean;
};

/** The day's five prayers in equal cells, and sunrise in the sixth. */
export const PrayerGrid = ({ selected, onSelect, nextOnly = false, progress = false }: Props) => {
  const { t } = useTranslation();
  const { now, day, following } = useShownDay();
  const locale = useAppStore((state) => state.locale);
  const use24HourTime = usePreferencesStore((state) => state.use24HourTime);
  const western = usePreferencesStore((state) => state.useWesternNumerals);

  if (!day) return null;

  const { lead, cards, progress: share } = prayerCards(day, now, following);
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
  const sunrisePassed = parseISO(sunrise).getTime() <= now.getTime();

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
            progress={progress ? share : null}
            onPress={(opener) => onSelect(card.id, opener)}
          />
        </Grid.Item>
      ))}
      {nextOnly ? null : (
        <Grid.Item key={OTHER_TIMING.SUNRISE}>
          {/* A card like the prayers', never lit and never a control. */}
          <HStack
            testID={PRAYER_GRID_PART.SUNRISE}
            accessible
            accessibilityLabel={t("a11y.today.prayerCard", {
              prayer: sunriseName,
              time: spoken(sunrise),
            })}
            {...CARD_FRAME}
            backgroundColor="$surfaceQuiet">
            <CardFace
              icon={PRAYER_ICONS[OTHER_TIMING.SUNRISE]}
              name={sunriseName}
              time={shown(sunrise)}
              lit={false}
              past={sunrisePassed}
              iconTestID={PRAYER_GRID_PART.SUNRISE_ICON}
            />
          </HStack>
        </Grid.Item>
      )}
    </Grid>
  );
};
