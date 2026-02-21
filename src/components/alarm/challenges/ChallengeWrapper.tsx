import { FC, useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress, ProgressFilledTrack } from "@/components/ui/progress";

import TapChallenge from "./TapChallenge";
import MathChallenge from "./MathChallenge";
import NoneChallenge from "./NoneChallenge";

import { ChallengeConfig, GRACE_PERIOD_SECONDS } from "@/types/alarm";

type Props = {
  config: ChallengeConfig;
  onAllComplete: () => void;
  onGraceStart?: () => void;
  onGraceExpire?: () => void;
};

function getGraceDuration(config: ChallengeConfig): number {
  if (config.type === "none") return 0;
  return GRACE_PERIOD_SECONDS[config.type][config.difficulty];
}

function getChallengeInstruction(
  t: (key: string, opts?: Record<string, unknown>) => string,
  type: string,
  difficulty: string,
  count: number
): string {
  if (type === "tap") {
    const taps = difficulty === "hard" ? 20 : difficulty === "medium" ? 10 : 5;
    return t("alarm.challenge.tapInstruction", { count: taps * count });
  }
  if (type === "math") {
    return t("alarm.challenge.mathInstruction", { count });
  }
  return t("alarm.challenge.dismissInstruction");
}

type GraceState = "idle" | "active" | "expired";

const ChallengeWrapper: FC<Props> = ({ config, onAllComplete, onGraceStart, onGraceExpire }) => {
  const { t } = useTranslation();
  const [started, setStarted] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [challengeKey, setChallengeKey] = useState(0);

  const { type, difficulty, count } = config;
  const progress = (completedCount / count) * 100;
  const graceDuration = getGraceDuration(config);

  const [graceState, setGraceState] = useState<GraceState>("idle");
  const [graceRemaining, setGraceRemaining] = useState(graceDuration);
  const graceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const graceStartTimeRef = useRef<number>(0);
  const graceExpiredRef = useRef(false);

  const clearGraceTimer = useCallback(() => {
    if (graceTimerRef.current) {
      clearInterval(graceTimerRef.current);
      graceTimerRef.current = null;
    }
  }, []);

  const startOrResetGrace = useCallback(() => {
    if (graceDuration <= 0) return;

    const wasIdle = graceStartTimeRef.current === 0;

    // Reset the countdown
    graceStartTimeRef.current = Date.now();
    setGraceRemaining(graceDuration);

    // If expired, silence alarm again
    if (graceExpiredRef.current) {
      graceExpiredRef.current = false;
      onGraceStart?.();
    }

    setGraceState("active");

    // Only create the interval once (first interaction)
    if (wasIdle) {
      onGraceStart?.();
      clearGraceTimer();
      graceTimerRef.current = setInterval(() => {
        const elapsed = (Date.now() - graceStartTimeRef.current) / 1000;
        const remaining = Math.max(0, graceDuration - elapsed);
        setGraceRemaining(remaining);

        if (remaining <= 0) {
          clearGraceTimer();
          graceExpiredRef.current = true;
          setGraceState("expired");
          onGraceExpire?.();
        }
      }, 100);
    }
  }, [graceDuration, clearGraceTimer, onGraceStart, onGraceExpire]);

  useEffect(() => {
    return clearGraceTimer;
  }, [clearGraceTimer]);

  const handleInteraction = useCallback(() => {
    startOrResetGrace();
  }, [startOrResetGrace]);

  const handleStartSolving = useCallback(() => {
    setStarted(true);
    // Silence alarm
    onGraceStart?.();
    // Start grace timer if configured
    if (graceDuration > 0) {
      startOrResetGrace();
    }
  }, [onGraceStart, graceDuration, startOrResetGrace]);

  const handleChallengeComplete = useCallback(() => {
    const newCount = completedCount + 1;
    setCompletedCount(newCount);

    if (newCount >= count) {
      clearGraceTimer();
      onAllComplete();
    } else {
      // Reset grace for next round but keep started — no sound restart
      clearGraceTimer();
      graceStartTimeRef.current = 0;
      graceExpiredRef.current = false;
      setGraceState("idle");
      setGraceRemaining(graceDuration);
      setChallengeKey((prev) => prev + 1);
    }
  }, [completedCount, count, onAllComplete, clearGraceTimer, graceDuration]);

  const graceProgress = graceDuration > 0 ? (graceRemaining / graceDuration) * 100 : 0;
  const graceColor = graceProgress > 30 ? "$primary" : graceProgress > 10 ? "$warning" : "$error";

  return (
    <VStack gap="$4" width="100%">
      {count > 1 && (
        <VStack gap="$2">
          <HStack justifyContent="space-between" alignItems="center">
            <Text size="sm" color="$typographySecondary">
              {t("alarm.challenge.progress")}
            </Text>
            <Badge size="sm" action="info">
              <Badge.Text>
                {completedCount}/{count}
              </Badge.Text>
            </Badge>
          </HStack>
          <Progress value={progress} size="sm">
            <ProgressFilledTrack />
          </Progress>
        </VStack>
      )}

      {graceDuration > 0 && graceState !== "idle" && (
        <VStack gap="$1">
          <Progress value={graceProgress} size="xs">
            <ProgressFilledTrack bg={graceColor} />
          </Progress>
          {graceState === "expired" && (
            <Text size="xs" color="$error" textAlign="center">
              {t("alarm.grace.expired")}
            </Text>
          )}
        </VStack>
      )}

      {!started ? (
        <VStack gap="$4" alignItems="center" width="100%">
          <Text size="sm" color="$typographySecondary" textAlign="center">
            {getChallengeInstruction(t, type, difficulty, count)}
          </Text>
          <Button size="xl" width="100%" onPress={handleStartSolving}>
            <Button.Text size="lg">{t("alarm.challenge.startSolving")}</Button.Text>
          </Button>
        </VStack>
      ) : type === "tap" ? (
        <TapChallenge
          key={challengeKey}
          difficulty={difficulty}
          onComplete={handleChallengeComplete}
          onInteraction={handleInteraction}
        />
      ) : type === "math" ? (
        <MathChallenge
          key={challengeKey}
          difficulty={difficulty}
          onComplete={handleChallengeComplete}
          onInteraction={handleInteraction}
        />
      ) : (
        <NoneChallenge onComplete={handleChallengeComplete} />
      )}
    </VStack>
  );
};

export default ChallengeWrapper;
