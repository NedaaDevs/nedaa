import { useEffect, useEffectEvent, useRef, useState, type ComponentProps } from "react";
import { BackHandler } from "react-native";
import { useTranslation } from "react-i18next";

import { countedPlace, resolveIndex, stepRank } from "@/components/onboarding/column";
import { dropCityTriedSince } from "@/components/onboarding/flow/CityChoice";
import { DayRunPlayer, toggleAction } from "@/components/onboarding/flow/DayRunPlayer";
import { OnboardingFrame } from "@/components/onboarding/flow/OnboardingFrame";
import { OnboardingLoading } from "@/components/onboarding/flow/OnboardingLoading";
import { StepTransition } from "@/components/onboarding/flow/StepTransition";
import { STEP_COMPONENT } from "@/components/onboarding/flow/steps";
import {
  NEW_SESSION,
  resumedSession,
  type OnboardingSession,
  type StepProps,
} from "@/components/onboarding/flow/types";
import { useOnboardingColumn } from "@/components/onboarding/flow/useOnboardingColumn";
import { DaySimulator } from "@/components/today/DaySimulator";
import { SkyBackground } from "@/components/ui/sky-background";
import { DAY_RUN_KIND, DAY_RUN_STATUS } from "@/constants/DayRun";
import {
  FRAME_MODE,
  LAST_STEP,
  ONBOARDING_LOADING_DELAY_MS,
  ONBOARDING_PATH,
  ONBOARDING_STEP,
  STEP_DIRECTION,
  STEP_LOCK_MS,
  STEP_ORDER,
  type OnboardingPath,
  type OnboardingStepId,
  type StepDirection,
} from "@/constants/Onboarding";
import { UPGRADE_PATH_STATE, type UpgradePathState } from "@/constants/UpgradePath";
import { useDayRun } from "@/contexts/DayRunContext";
import { useDelayedFlag } from "@/hooks/useDelayedFlag";
import { useHaptic } from "@/hooks/useHaptic";
import { useLayoutFocus } from "@/hooks/useLayoutFocus";
import { HAPTIC_FEEDBACK } from "@/constants/Haptics";
import { useAppStore } from "@/stores/app";

/** Gives `step` the claim, or drops a claim that `step` holds. */
const claimFor =
  (step: OnboardingStepId, on: boolean) =>
  (held: OnboardingStepId | null): OnboardingStepId | null =>
    on ? step : held === step ? null : held;

/** A fetch that has stored the day; the flow passes it both ways. */
const isSettledFetch = (column: readonly OnboardingStepId[], at: number) =>
  column[at] === ONBOARDING_STEP.FETCH && column.includes(ONBOARDING_STEP.CALCULATION);

/** The frame; in a day run the player takes its bar and back closes the run. */
const RunFrame = (props: ComponentProps<typeof OnboardingFrame>) => {
  const run = useDayRun();
  if (!run || run.status === DAY_RUN_STATUS.IDLE) return <OnboardingFrame {...props} />;
  // Skip ends the run with no focus move: the next step takes focus.
  const skip = () => {
    run.end();
    props.onSkip();
  };
  return (
    <OnboardingFrame
      {...props}
      onBack={run.close}
      onSkip={skip}
      // Wherever reader focus is on the step, a magic tap works the toggle.
      onMagicTap={toggleAction(run)}
      bar={<DayRunPlayer />}
    />
  );
};

/** Where a reopened upgrade path starts; it records no step as passed. */
const upgradeStart = (state: UpgradePathState): OnboardingStepId | null =>
  state === UPGRADE_PATH_STATE.RESUMED ? ONBOARDING_STEP.APPEARANCE : null;

type Props = {
  /** The walk to draw: the first run, or the upgrade path. */
  path: OnboardingPath;
  /** The gate is fading it out: Android back passes through to the app. */
  leaving?: boolean;
};

/** One sky, one column of steps for the walk, one step id into it. */
export const OnboardingFlow = ({ path, leaving = false }: Props) => {
  const { t } = useTranslation();
  const upgrading = path === ONBOARDING_PATH.UPGRADE;
  const order = STEP_ORDER[path];
  const saved = useAppStore((state) => state.onboardingStep);
  const setOnboardingStep = useAppStore((state) => state.setOnboardingStep);
  const setIsFirstRun = useAppStore((state) => state.setIsFirstRun);
  const setUpgradePath = useAppStore((state) => state.setUpgradePath);
  const upgradePath = useAppStore((state) => state.upgradePath);
  const haptic = useHaptic(HAPTIC_FEEDBACK.LIGHT);
  const [start] = useState(() => (upgrading ? upgradeStart(upgradePath) : saved));
  const [session, setSession] = useState<OnboardingSession>(() =>
    upgrading ? NEW_SESSION : resumedSession(start)
  );
  const column = useOnboardingColumn(session, path);
  const showLoading = useDelayedFlag(column === null, ONBOARDING_LOADING_DELAY_MS);
  const [stepId, setStepId] = useState<OnboardingStepId | null>(start);
  const [advanceFrom, setAdvanceFrom] = useState<OnboardingStepId | null>(null);
  // The step last drawn, and every step drawn in this session.
  const [drawn, setDrawn] = useState<OnboardingStepId | null>(null);
  const [shownSteps, setShownSteps] = useState<ReadonlySet<OnboardingStepId>>(() => new Set());
  const [direction, setDirection] = useState<StepDirection>(STEP_DIRECTION.FORWARD);
  // Keyed to the step that set them: no other step sees them.
  const [busyFor, setBusyFor] = useState<OnboardingStepId | null>(null);
  const [primaryHiddenFor, setPrimaryHiddenFor] = useState<OnboardingStepId | null>(null);
  const [backFor, setBackFor] = useState<OnboardingStepId | null>(null);
  const [primaryFor, setPrimaryFor] = useState<{ step: OnboardingStepId; label: string } | null>(
    null
  );
  const primaryPress = useRef<(() => void) | null>(null);
  const backPress = useRef<(() => void) | null>(null);
  const { ref: headingRef, onLayout: onHeadingLayout, focus: focusHeading } = useLayoutFocus();
  const shown = useRef<OnboardingStepId | null>(null);
  const lockUntil = useRef(0);
  const ending = useRef(false);
  // The run's start; a city chosen after it was tried in this run.
  const startedAt = useRef(0);

  // Resolved in render against the step's own changes; this render draws it.
  let target = stepId;
  if (advanceFrom !== null && column !== null) {
    setAdvanceFrom(null);
    // Only the step on screen moves the user; a request from one left is stale.
    if (advanceFrom === stepId) {
      const at = column.indexOf(advanceFrom);
      // A step still shown moves one on; a removed one has resolved forward.
      const next = at >= 0 ? at + 1 : resolveIndex(order, column, advanceFrom);
      const to = isSettledFetch(column, next) ? next + 1 : next;
      if (to < column.length) target = column[to];
    }
  }

  const index = column ? resolveIndex(order, column, target) : -1;
  const current = column?.[index];
  const busy = current !== undefined && busyFor === current;
  // Cleared on a step change: a returning step uses the frame's until it asks.
  if (primaryHiddenFor !== null && primaryHiddenFor !== current) setPrimaryHiddenFor(null);
  if (backFor !== null && backFor !== current) setBackFor(null);
  const ownPrimary = primaryFor !== null && primaryFor.step === current ? primaryFor : null;
  const ownsBack = current !== undefined && backFor === current;

  // Settles on the step drawn, so a removed id that returns cannot pull back.
  if (current !== undefined && stepId !== current) setStepId(current);

  // The motion follows the sign of the move in the fixed order.
  if (current !== undefined && current !== drawn) {
    setDrawn(current);
    if (drawn !== null) {
      setDirection(
        stepRank(order, current) > stepRank(order, drawn)
          ? STEP_DIRECTION.FORWARD
          : STEP_DIRECTION.BACK
      );
    }
    if (!shownSteps.has(current)) setShownSteps(new Set(shownSteps).add(current));
  }

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const arrive = useEffectEvent(() => {
    if (current === undefined) return;
    // The upgrade path reopens at its start, so it saves no step.
    if (!upgrading && (saved === null || stepRank(order, current) > stepRank(order, saved))) {
      setOnboardingStep(current);
    }
    focusHeading();
    if (shown.current !== null) {
      // Completion plays its own success haptic in place of the step tap.
      if (current !== LAST_STEP[path]) void haptic();
      lockUntil.current = Date.now() + STEP_LOCK_MS;
    }
    shown.current = current;
  });
  useEffect(() => {
    arrive();
  }, [current]);

  const locked = () => Date.now() < lockUntil.current;
  const advance = (from: OnboardingStepId) => {
    if (from !== LAST_STEP[path]) {
      setAdvanceFrom(from);
      return;
    }
    // The walk ends once, and not from a tap that lands during the lock.
    if (locked() || ending.current) return;
    ending.current = true;
    if (upgrading) setUpgradePath(UPGRADE_PATH_STATE.DONE);
    else setIsFirstRun(false);
  };
  const back = () => {
    if (column === null || locked() || busy) return;
    // A step's sub-view takes back first: it returns to its parent view.
    if (ownsBack) {
      backPress.current?.();
      return;
    }
    if (index <= 0) return;
    // A fetch behind the user has run; going back never runs it again.
    const to = column[index - 1] === ONBOARDING_STEP.FETCH ? index - 2 : index - 1;
    if (to >= 0) setStepId(column[to]);
  };
  const skip = () => {
    if (current === undefined || locked() || busy) return;
    advance(current);
  };
  const primary = () => {
    if (current === undefined || locked() || busy) return;
    if (ownPrimary) primaryPress.current?.();
    else advance(current);
  };

  const onHardwareBack = useEffectEvent(() => {
    if (leaving || (!ownsBack && index <= 0)) return false;
    back();
    return true;
  });
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => onHardwareBack());
    return () => subscription.remove();
  }, []);

  // Both returns draw the same tree above the sky, so the sky mounts once.
  if (column === null || current === undefined) {
    return (
      <DaySimulator kind={DAY_RUN_KIND.PREVIEW}>
        <SkyBackground>{showLoading ? <OnboardingLoading /> : null}</SkyBackground>
      </DaySimulator>
    );
  }

  // Welcome and Completion have no place: the bars stay off them.
  const place = countedPlace(order, column, shownSteps, current);
  const progress = place ? t("onboarding.progress", place) : "";
  const stepProps: StepProps = {
    onNext: () => advance(current),
    onSkip: skip,
    setBusy: (next) => setBusyFor(claimFor(current, next)),
    setPrimaryHidden: (hidden) => setPrimaryHiddenFor(claimFor(current, hidden)),
    setBack: (handler) => {
      if (handler) backPress.current = handler;
      setBackFor(claimFor(current, handler !== null));
    },
    dropTriedCity: () => dropCityTriedSince(startedAt.current),
    session,
    setSession: (patch) => setSession((prev) => ({ ...prev, ...patch })),
    setPrimary: (next) => {
      primaryPress.current = next?.onPress ?? null;
      setPrimaryFor((prev) => {
        if (next === null) return prev?.step === current ? null : prev;
        return prev?.step === current && prev.label === next.label
          ? prev
          : { step: current, label: next.label };
      });
    },
    headingRef,
    onHeadingLayout,
    focusHeading,
    progress,
    path,
  };
  const Step = STEP_COMPONENT[current];

  return (
    <DaySimulator kind={DAY_RUN_KIND.PREVIEW}>
      <SkyBackground>
        <RunFrame
          mode={place ? FRAME_MODE.CHROME : FRAME_MODE.BARE}
          progress={progress}
          fraction={place ? place.current / place.total : 0}
          canGoBack={index > 0}
          busy={busy}
          showPrimary={primaryHiddenFor !== current}
          primaryLabel={ownPrimary?.label ?? t("onboarding.continue")}
          onPrimary={primary}
          onBack={back}
          onSkip={skip}>
          <StepTransition key={current} direction={direction}>
            <Step {...stepProps} />
          </StepTransition>
        </RunFrame>
      </SkyBackground>
    </DaySimulator>
  );
};
