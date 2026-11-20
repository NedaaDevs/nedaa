import { Fragment, useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AudioOnboarding from "@/components/athkar/AudioOnboarding";
import { FocusAudioButton } from "@/components/athkar/session/FocusAudioButton";
import { FocusControl } from "@/components/athkar/session/FocusControl";
import { SessionDone } from "@/components/athkar/session/SessionDone";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { ClaimSkyBodies } from "@/components/ui/sky-background/bodies";
import { StatePanel } from "@/components/ui/state-panel";
import { ATHKAR_TYPE } from "@/constants/Athkar";
import { type StepDirection } from "@/constants/AthkarFocus";
import {
  SESSION_SOURCE,
  SESSION_STATUS,
  type CollectionSource,
  type SessionSource,
} from "@/constants/AthkarSession";
import { useAthkarDayLoad } from "@/hooks/useAthkarDayLoad";
import { useAthkarLook } from "@/hooks/useAthkarLook";
import { useAthkarSession, type AthkarSession, type SessionLoad } from "@/hooks/useAthkarSession";
import {
  useCustomPort,
  useDailyPort,
  useHisnPort,
  type CollectionPort,
} from "@/hooks/useAthkarSessionPort";
import { useCollectionTitle } from "@/hooks/useCollectionTitle";
import { useStartAthkarAudio } from "@/hooks/useStartAthkarAudio";
import { athkarPlayer } from "@/services/athkar-player";
import { useAthkarStore } from "@/stores/athkar";
import { PLAYER_STATE } from "@/types/athkar-audio";
import { DAILY_SOURCE } from "@/utils/athkarSessionSource";

/** Test ids for the screen's states and parts. */
export const ATHKAR_FOCUS_SCREEN_PART = {
  LOADING: "athkar-focus-loading",
  NO_AUDIO: "athkar-focus-no-audio",
} as const;

/** A state with no dhikr to touch: its content under the close control. */
const Plain = ({ close, children }: { close: ReactNode; children: ReactNode }) => (
  <Box flex={1} paddingHorizontal="$3.5">
    <HStack justifyContent="flex-end">{close}</HStack>
    <Box flex={1} justifyContent="center">
      {children}
    </Box>
  </Box>
);

type StageProps = {
  session: AthkarSession;
  /** The session's name, shown at the top. */
  title: string;
  /** Said and shown when every dhikr is finished. */
  doneMessage: string;
  /** Shown once the load ends with no session. */
  load: SessionLoad;
  onStep: (by: StepDirection) => void;
  /** The audio control, or a blank of its size that keeps the title centred. */
  audio: ReactNode;
  children?: ReactNode;
};

/** Focus over a session, whatever its source: its states under the close control. */
const FocusScreen = ({
  session,
  title,
  doneMessage,
  load,
  onStep,
  audio,
  children,
}: StageProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const look = useAthkarLook();
  const { status, current } = session;
  const hintSeen = useAthkarStore((s) => s.focusHintSeen);
  const markHintSeen = useAthkarStore((s) => s.markFocusHintSeen);

  // A session that ends here is said aloud; focus reads one opened finished.
  const [wasReady, setWasReady] = useState(false);
  if (status === SESSION_STATUS.READY && !wasReady) setWasReady(true);

  const close = (
    <FocusControl
      icon={X}
      accessibilityLabel={t("a11y.athkar.focus.close")}
      onPress={() => router.back()}
    />
  );

  const body = () => {
    if (status === SESSION_STATUS.DONE) {
      return (
        <Plain close={close}>
          <SessionDone message={doneMessage} announce={wasReady} />
        </Plain>
      );
    }
    if (status === SESSION_STATUS.READY && current) {
      return (
        <look.Focus
          session={session}
          period={title}
          hintSeen={hintSeen}
          onHintSeen={markHintSeen}
          onStep={onStep}
          close={close}
          audio={audio}
        />
      );
    }
    if (load.settled) {
      return (
        <Plain close={close}>
          <StatePanel
            title={t("athkar.session.loadError.title")}
            body={t("athkar.session.loadError.body")}
            action={load.retry && { label: t("common.retry"), onPress: load.retry }}
          />
        </Plain>
      );
    }
    return (
      <Plain close={close}>
        <Box
          testID={ATHKAR_FOCUS_SCREEN_PART.LOADING}
          flex={1}
          accessible
          accessibilityLabel={t("athkar.loading.initializing")}
        />
      </Plain>
    );
  };

  const Ground = look.FocusGround ?? Fragment;
  return (
    <Ground>
      {/* Focus draws its own count; the sky's sun and moon stay out. */}
      <ClaimSkyBodies />
      <Box flex={1} paddingTop={insets.top} paddingBottom={insets.bottom}>
        {body()}
        {children}
      </Box>
    </Ground>
  );
};

/** Focus on the morning or evening session, with its audio. */
const DailyFocus = () => {
  const { t } = useTranslation();
  const session = useAthkarSession(useDailyPort());
  const day = useAthkarDayLoad();
  const audio = useStartAthkarAudio();
  const type = useAthkarStore((s) => s.currentType);
  const playerState = useAthkarStore((s) => s.playerState);
  const { current } = session;

  const done = session.status === SESSION_STATUS.DONE;
  const playing = playerState !== PLAYER_STATE.IDLE;
  useEffect(() => {
    if (done && playing) void athkarPlayer.stop();
  }, [done, playing]);

  const period = t(type === ATHKAR_TYPE.MORNING ? "athkar.morning" : "athkar.evening");

  // Playing audio owns the place: the player moves to the dhikr beside it.
  const step = (by: StepDirection) => {
    if (playerState !== PLAYER_STATE.PLAYING) return session.step(by);
    const beside = session.index === null ? undefined : session.items[session.index + by];
    if (beside) void athkarPlayer.jumpTo(beside.id);
  };

  return (
    <FocusScreen
      session={session}
      title={period}
      doneMessage={t("athkar.session.done", { type: period })}
      load={day}
      onStep={step}
      audio={
        <FocusAudioButton
          state={playerState}
          onPress={() => {
            if (playerState === PLAYER_STATE.PLAYING) void athkarPlayer.pause();
            else if (current) audio.start(current.item.id);
          }}
        />
      }>
      <AudioOnboarding isOpen={audio.onboardingOpen} onClose={audio.closeOnboarding} />
    </FocusScreen>
  );
};

/** Focus on a collection. One that is gone, once its store has loaded, cannot load. */
const CollectionFocus = ({ source, port }: { source: CollectionSource; port: CollectionPort }) => {
  const { t } = useTranslation();
  const title = useCollectionTitle(source);
  const session = useAthkarSession({ ...port, ready: port.ready && title !== null });
  const gone = port.ready && title === null;
  return (
    <FocusScreen
      session={session}
      title={title ?? ""}
      doneMessage={t("athkar.session.collectionDone")}
      load={gone ? { settled: true } : port.load}
      onStep={session.step}
      audio={<Box testID={ATHKAR_FOCUS_SCREEN_PART.NO_AUDIO} width="$target" height="$target" />}
    />
  );
};

const HisnFocus = ({ categoryId }: { categoryId: number }) => {
  const port = useHisnPort(categoryId);
  return <CollectionFocus source={{ kind: SESSION_SOURCE.HISN, categoryId }} port={port} />;
};

const CustomFocus = ({ groupId }: { groupId: number }) => {
  const port = useCustomPort(groupId);
  return <CollectionFocus source={{ kind: SESSION_SOURCE.CUSTOM, groupId }} port={port} />;
};

type AthkarFocusScreenProps = {
  /** The session Focus opens on; the daily one when none is named. */
  source?: SessionSource;
};

/** Focus mode: a session's current dhikr alone, counted by touch. */
export const AthkarFocusScreen = ({ source = DAILY_SOURCE }: AthkarFocusScreenProps) => {
  switch (source.kind) {
    case SESSION_SOURCE.DAILY:
      return <DailyFocus />;
    case SESSION_SOURCE.HISN:
      return <HisnFocus categoryId={source.categoryId} />;
    case SESSION_SOURCE.CUSTOM:
      return <CustomFocus groupId={source.groupId} />;
  }
};
