import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";

import AudioOnboarding from "@/components/athkar/AudioOnboarding";
import { SessionDone } from "@/components/athkar/session/SessionDone";
import { SessionListSheet } from "@/components/athkar/session/SessionListSheet";
import { Box } from "@/components/ui/box";
import { Skeleton } from "@/components/ui/skeleton";
import { StatePanel } from "@/components/ui/state-panel";
import { VStack } from "@/components/ui/vstack";
import { ATHKAR_TYPE } from "@/constants/Athkar";
import { ATHKAR_FOCUS_HREF, SESSION_STATUS } from "@/constants/AthkarSession";
import { useAthkarDayLoad } from "@/hooks/useAthkarDayLoad";
import { useAthkarLook } from "@/hooks/useAthkarLook";
import { useAthkarSession, useSessionOpening } from "@/hooks/useAthkarSession";
import { useStartAthkarAudio } from "@/hooks/useStartAthkarAudio";
import { useAthkarStore } from "@/stores/athkar";

/** Test ids for the screen's states. */
export const ATHKAR_SESSION_SCREEN_PART = {
  LOADING: "athkar-session-loading",
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

/** The morning or evening session: its states, its list and its ways out. */
export const AthkarSessionScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  useSessionOpening();
  const session = useAthkarSession();
  const { status, current } = session;
  const day = useAthkarDayLoad();
  const audio = useStartAthkarAudio();
  const look = useAthkarLook();

  const type = useAthkarStore((s) => s.currentType);
  const [listOpen, setListOpen] = useState(false);
  // A session that ends under the reader is said aloud; one opened finished is read by focus.
  const [wasReady, setWasReady] = useState(false);
  if (status === SESSION_STATUS.READY && !wasReady) setWasReady(true);

  const period = t(type === ATHKAR_TYPE.MORNING ? "athkar.morning" : "athkar.evening");

  const body = () => {
    if (status === SESSION_STATUS.DONE) {
      return (
        <SessionDone message={t("athkar.session.done", { type: period })} announce={wasReady} />
      );
    }
    if (status === SESSION_STATUS.READY) {
      return (
        <look.Reader
          session={session}
          onOpenList={() => setListOpen(true)}
          onOpenFocus={() => router.push(ATHKAR_FOCUS_HREF)}
          onStartAudio={() => current && audio.start(current.item.id)}
        />
      );
    }
    if (day.settled) {
      return (
        <Box paddingTop="$3">
          <StatePanel
            title={t("athkar.session.loadError.title")}
            body={t("athkar.session.loadError.body")}
            action={{ label: t("common.retry"), onPress: day.retry }}
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
      <AudioOnboarding isOpen={audio.onboardingOpen} onClose={audio.closeOnboarding} />
    </VStack>
  );
};
