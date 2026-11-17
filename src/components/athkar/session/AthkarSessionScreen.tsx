import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";

import AudioOnboarding from "@/components/athkar/AudioOnboarding";
import { ClassicReader } from "@/components/athkar/looks/classic/ClassicReader";
import { SessionListSheet } from "@/components/athkar/session/SessionListSheet";
import { Box } from "@/components/ui/box";
import { SpokenStatus } from "@/components/ui/live-region";
import { HighlightEdge, useElevationShadow } from "@/components/ui/material/edge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatePanel } from "@/components/ui/state-panel";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { ATHKAR_TYPE } from "@/constants/Athkar";
import { ATHKAR_FOCUS_HREF, SESSION_STATUS } from "@/constants/AthkarSession";
import { ELEVATION_LEVEL } from "@/constants/Elevation";
import { useAthkarSession } from "@/hooks/useAthkarSession";
import { athkarPlayer } from "@/services/athkar-player";
import { useAthkarStore } from "@/stores/athkar";
import { useAthkarAudioStore } from "@/stores/athkar-audio";
import { PLAYER_STATE } from "@/types/athkar-audio";
import { AppLogger } from "@/utils/appLogger";

const log = AppLogger.create("athkar");

/** Test ids for the screen's states. */
export const ATHKAR_SESSION_SCREEN_PART = {
  LOADING: "athkar-session-loading",
  DONE: "athkar-session-done",
} as const;

/** The reader's outline: the hero and the Focus row. */
const Loading = ({ label }: { label: string }) => (
  <VStack
    testID={ATHKAR_SESSION_SCREEN_PART.LOADING}
    flex={1}
    gap="$3"
    paddingTop="$3"
    accessible
    accessibilityLabel={label}
    accessibilityState={{ busy: true }}>
    <Box flex={1} borderRadius="$hero" overflow="hidden">
      <Skeleton variant="sharp" />
    </Box>
    <Box height="$14" borderRadius="$card" overflow="hidden">
      <Skeleton variant="sharp" />
    </Box>
  </VStack>
);

type DoneProps = { message: string; announce: boolean };

/** Every dhikr of the session is counted. */
const Done = ({ message, announce }: DoneProps) => {
  const lift = useElevationShadow(ELEVATION_LEVEL.E2);
  return (
    <VStack
      testID={ATHKAR_SESSION_SCREEN_PART.DONE}
      flex={1}
      alignItems="center"
      justifyContent="center"
      marginTop="$3"
      padding="$4"
      borderRadius="$hero"
      backgroundColor="$raised"
      style={{ boxShadow: lift }}>
      <HighlightEdge owner={ATHKAR_SESSION_SCREEN_PART.DONE} radius="$hero" />
      <Text size="headline" fontWeight="500" color="$fg" textAlign="center">
        {message}
      </Text>
      <SpokenStatus message={announce ? message : null} />
    </VStack>
  );
};

/** The morning or evening session: its states, its list and its ways out. */
export const AthkarSessionScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const session = useAthkarSession();
  const { status, current } = session;

  const type = useAthkarStore((s) => s.currentType);
  const hasLists = useAthkarStore(
    (s) => s.morningAthkarList.length > 0 || s.eveningAthkarList.length > 0
  );
  const initializeTodayData = useAthkarStore((s) => s.initializeTodayData);
  const playerState = useAthkarStore((s) => s.playerState);
  const playingId = useAthkarStore((s) => s.currentAthkarId);
  const onboarded = useAthkarAudioStore((s) => s.onboardingCompleted);

  const [listOpen, setListOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<number | null>(null);
  // A session that ends under the reader is said aloud; one opened finished is read by focus.
  const [wasReady, setWasReady] = useState(false);
  if (status === SESSION_STATUS.READY && !wasReady) setWasReady(true);

  // Today's rows need the lists; a load that ends still loading has failed.
  useEffect(() => {
    if (!hasLists) return;
    let live = true;
    initializeTodayData()
      .catch((error: unknown) =>
        log.e(
          "Session",
          "today's athkar did not load",
          error instanceof Error ? error : new Error(String(error))
        )
      )
      .finally(() => {
        if (live) setSettled(attempt);
      });
    return () => {
      live = false;
    };
  }, [hasLists, attempt, initializeTodayData]);

  const startAudio = () => {
    if (!current) return;
    if (!onboarded) {
      setOnboardingOpen(true);
      return;
    }
    const { id } = current.item;
    if (playingId === id && playerState === PLAYER_STATE.PAUSED) void athkarPlayer.play();
    else void athkarPlayer.startAndJumpTo(id);
  };

  const period = t(type === ATHKAR_TYPE.MORNING ? "athkar.morning" : "athkar.evening");

  const body = () => {
    if (status === SESSION_STATUS.DONE) {
      return <Done message={t("athkar.session.done", { type: period })} announce={wasReady} />;
    }
    if (status === SESSION_STATUS.READY) {
      return (
        <ClassicReader
          session={session}
          onOpenList={() => setListOpen(true)}
          onOpenFocus={() => router.push(ATHKAR_FOCUS_HREF)}
          onStartAudio={startAudio}
        />
      );
    }
    if (settled === attempt) {
      return (
        <Box paddingTop="$3">
          <StatePanel
            title={t("athkar.session.loadError.title")}
            body={t("athkar.session.loadError.body")}
            action={{ label: t("common.retry"), onPress: () => setAttempt((n) => n + 1) }}
          />
        </Box>
      );
    }
    return <Loading label={t("athkar.loading.initializing")} />;
  };

  return (
    <VStack flex={1}>
      {body()}
      <SessionListSheet
        open={listOpen && status === SESSION_STATUS.READY}
        title={period}
        items={session.items}
        counts={session.counts}
        index={session.index}
        onJump={session.jumpTo}
        onClose={() => setListOpen(false)}
      />
      <AudioOnboarding isOpen={onboardingOpen} onClose={() => setOnboardingOpen(false)} />
    </VStack>
  );
};
