import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AudioOnboarding from "@/components/athkar/AudioOnboarding";
import { CLASSIC_LOOK } from "@/components/athkar/looks/classic/look";
import { FocusAudioButton } from "@/components/athkar/session/FocusAudioButton";
import { FocusControl } from "@/components/athkar/session/FocusControl";
import { SessionDone } from "@/components/athkar/session/SessionDone";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { StatePanel } from "@/components/ui/state-panel";
import { ATHKAR_TYPE } from "@/constants/Athkar";
import { type StepDirection } from "@/constants/AthkarFocus";
import { SESSION_STATUS } from "@/constants/AthkarSession";
import { useAthkarDayLoad } from "@/hooks/useAthkarDayLoad";
import { useAthkarSession } from "@/hooks/useAthkarSession";
import { useStartAthkarAudio } from "@/hooks/useStartAthkarAudio";
import { athkarPlayer } from "@/services/athkar-player";
import { useAthkarStore } from "@/stores/athkar";
import { PLAYER_STATE } from "@/types/athkar-audio";

/** Test ids for the screen's states. */
export const ATHKAR_FOCUS_SCREEN_PART = {
  LOADING: "athkar-focus-loading",
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

/** Focus mode: the session's current dhikr alone, counted by touch. */
export const AthkarFocusScreen = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useAthkarSession();
  const { status, current } = session;
  const day = useAthkarDayLoad();
  const audio = useStartAthkarAudio();

  const type = useAthkarStore((s) => s.currentType);
  const playerState = useAthkarStore((s) => s.playerState);
  const hintSeen = useAthkarStore((s) => s.focusHintSeen);
  const markHintSeen = useAthkarStore((s) => s.markFocusHintSeen);

  // A session that ends here is said aloud; focus reads one opened finished.
  const [wasReady, setWasReady] = useState(false);
  if (status === SESSION_STATUS.READY && !wasReady) setWasReady(true);

  const done = status === SESSION_STATUS.DONE;
  const playing = playerState !== PLAYER_STATE.IDLE;
  useEffect(() => {
    if (done && playing) void athkarPlayer.stop();
  }, [done, playing]);

  const period = t(type === ATHKAR_TYPE.MORNING ? "athkar.morning" : "athkar.evening");
  const close = (
    <FocusControl
      icon={X}
      accessibilityLabel={t("a11y.athkar.focus.close")}
      onPress={() => router.back()}
    />
  );

  // Playing audio owns the place: the player moves to the dhikr beside it.
  const step = (by: StepDirection) => {
    if (playerState !== PLAYER_STATE.PLAYING) return session.step(by);
    const beside = session.index === null ? undefined : session.items[session.index + by];
    if (beside) void athkarPlayer.jumpTo(beside.id);
  };

  const body = () => {
    if (done) {
      return (
        <Plain close={close}>
          <SessionDone message={t("athkar.session.done", { type: period })} announce={wasReady} />
        </Plain>
      );
    }
    if (status === SESSION_STATUS.READY && current) {
      const { id } = current.item;
      return (
        <CLASSIC_LOOK.Focus
          session={session}
          period={period}
          hintSeen={hintSeen}
          onHintSeen={markHintSeen}
          onStep={step}
          close={close}
          audio={
            <FocusAudioButton
              state={playerState}
              onPress={() =>
                playerState === PLAYER_STATE.PLAYING ? void athkarPlayer.pause() : audio.start(id)
              }
            />
          }
        />
      );
    }
    if (day.settled) {
      return (
        <Plain close={close}>
          <StatePanel
            title={t("athkar.session.loadError.title")}
            body={t("athkar.session.loadError.body")}
            action={{ label: t("common.retry"), onPress: day.retry }}
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

  return (
    <Box flex={1} backgroundColor="$background" paddingBottom={insets.bottom}>
      {body()}
      <AudioOnboarding isOpen={audio.onboardingOpen} onClose={audio.closeOnboarding} />
    </Box>
  );
};
