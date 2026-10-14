import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { ChooseCityButton, StepCityPicker } from "@/components/onboarding/flow/CityChoice";
import { OnboardingCard } from "@/components/onboarding/flow/OnboardingCard";
import { OnboardingPreview } from "@/components/onboarding/flow/OnboardingPreview";
import { StepBody } from "@/components/onboarding/flow/StepBody";
import { StepHeading } from "@/components/onboarding/flow/StepHeading";
import type { StepProps } from "@/components/onboarding/flow/types";
import { useStepPrimary } from "@/components/onboarding/flow/useStepPrimary";
import { useViewFocus } from "@/components/onboarding/flow/useViewFocus";
import { SkyOccluder } from "@/components/ui/sky-background";
import { Text } from "@/components/ui/text";
import {
  FETCH_ATTEMPT_TIMEOUT_MS,
  FETCH_PHASE,
  FETCH_RETRY_MS,
  FETCH_STAGE,
  LOCATION_CHOICE,
  type FetchPhase,
  type FetchStage,
} from "@/constants/Onboarding";
import { LocationMode, type LocationModeValue } from "@/enums/location";
import { initDatabases } from "@/services/databases";
import { useLocationStore } from "@/stores/location";
import { usePrayerTimesStore } from "@/stores/prayerTimes";
import { AppLogger } from "@/utils/appLogger";
import { errorText } from "@/utils/errorText";
import { todayStored } from "@/utils/timesPlace";
import { withDeadline } from "@/utils/withTimeout";

const log = AppLogger.create("prayertimes");

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type OnStage = (stage: FetchStage) => void;

/** A try starts on the device's fix in automatic mode, else on the times. */
const firstStage = (mode: LocationModeValue): FetchStage =>
  mode === LocationMode.DEVICE ? FETCH_STAGE.LOCATING_DEVICE : FETCH_STAGE.LOADING_TIMES;

/** One try: a verified fix, then its times; a stage starts only while live. */
const attemptFetch = async (live: () => boolean, onStage: OnStage): Promise<boolean> => {
  // Each stage is set before its wait, and only while the try is live.
  const enter = (stage: FetchStage) => {
    if (live()) onStage(stage);
  };
  const mode = useLocationStore.getState().locationMode;
  const device = mode === LocationMode.DEVICE;
  enter(firstStage(mode));
  await initDatabases();
  if (!live()) return false;
  // The fix throws when it fails; the fetch alone uses a default place.
  if (device) await useLocationStore.getState().initializeLocation();
  if (!live()) return false;
  enter(FETCH_STAGE.LOADING_TIMES);
  await usePrayerTimesStore.getState().loadPrayerTimesAtCurrentPlace(true);
  if (!todayStored()) throw new Error("no day stored for a verified place");
  return true;
};

/** Whether one try landed in time; a live failure is logged, not shown. */
const tryFetch = (live: () => boolean, onStage: OnStage) =>
  withDeadline(
    (inTime) => attemptFetch(() => live() && inTime(), onStage),
    FETCH_ATTEMPT_TIMEOUT_MS,
    `no answer within ${FETCH_ATTEMPT_TIMEOUT_MS}ms`
  ).catch((error: unknown) => {
    if (live()) log.w("Onboarding", `first fetch failed: ${errorText(error)}`);
    return false;
  });

/** Whether the times landed: one try, then one silent retry while live. */
const fetchLanded = async (live: () => boolean, onStage: OnStage) => {
  if (await tryFetch(live, onStage)) return true;
  await wait(FETCH_RETRY_MS);
  return live() ? tryFetch(live, onStage) : false;
};

/** The first times for the user's place, never invented; one silent retry. */
export const FetchStep = ({
  onNext,
  session,
  setSession,
  setPrimary,
  setPrimaryHidden,
  setBack,
  dropTriedCity,
  headingRef,
  progress,
}: StepProps) => {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<FetchPhase>(FETCH_PHASE.LOADING);
  // The view the picker opened over, which its back returns to.
  const [pickedFrom, setPickedFrom] = useState<FetchPhase>(FETCH_PHASE.LOADING);
  // Right from the first frame; each try then moves it as it goes.
  const [stage, setStage] = useState<FetchStage>(() =>
    firstStage(useLocationStore.getState().locationMode)
  );
  const started = useRef(false);
  const mounted = useRef(false);
  // Each fetch, and the picker, bumps it; a stale fetch acts on nothing.
  const generation = useRef(0);
  const movedOn = useRef(false);

  const moveOn = () => {
    if (movedOn.current) return;
    movedOn.current = true;
    onNext();
  };

  // The flow is never held busy here, so Skip and Back stay open while loading.
  const fetchTimes = () => {
    generation.current += 1;
    const mine = generation.current;
    const live = () => mounted.current && generation.current === mine;
    return fetchLanded(live, setStage).then((landed) => {
      if (!live()) return;
      if (landed) moveOn();
      else setPhase(FETCH_PHASE.ERROR);
    });
  };

  const chooseCity = () => {
    generation.current += 1;
    setPickedFrom(phase);
    setPhase(FETCH_PHASE.PICKER);
  };

  const begin = useEffectEvent(() => {
    if (started.current) return;
    started.current = true;
    // Marked first, so the stored day cannot drop this step mid-load.
    setSession({ fetchStarted: true });
    if (todayStored()) moveOn();
    else void fetchTimes();
  });
  useEffect(() => {
    mounted.current = true;
    begin();
    return () => {
      mounted.current = false;
    };
  }, []);

  useViewFocus(phase, headingRef);

  const retry = () => {
    setPhase(FETCH_PHASE.LOADING);
    void fetchTimes();
  };
  // Back returns to the view the picker opened over: the error, or a new load.
  const closePicker = () => {
    if (session.locationChoice === LOCATION_CHOICE.AUTOMATIC) dropTriedCity();
    if (pickedFrom === FETCH_PHASE.ERROR) setPhase(FETCH_PHASE.ERROR);
    else retry();
  };

  useStepPrimary(
    setPrimary,
    phase === FETCH_PHASE.ERROR ? { label: t("common.retry"), onPress: retry } : null
  );

  // Only the error shows the frame's primary, for Retry; set before paint.
  useLayoutEffect(() => {
    setPrimaryHidden(phase !== FETCH_PHASE.ERROR);
  });

  if (phase === FETCH_PHASE.PICKER) {
    return (
      <StepCityPicker
        headingRef={headingRef}
        progress={progress}
        setBack={setBack}
        setPrimaryHidden={setPrimaryHidden}
        onDone={() => {
          setSession({ locationChoice: LOCATION_CHOICE.CITY });
          moveOn();
        }}
        onClose={closePicker}
      />
    );
  }

  if (phase === FETCH_PHASE.ERROR) {
    return (
      <StepBody>
        <StepHeading
          headingRef={headingRef}
          progress={progress}
          title={t("today.failed.title")}
          body={t("onboarding.fetch.errorBody")}
        />
        <SkyOccluder>
          <OnboardingCard>
            <Text size="sm" color="$fg">
              {t("onboarding.fetch.errorCard")}
            </Text>
          </OnboardingCard>
        </SkyOccluder>
        <ChooseCityButton onPress={chooseCity} />
      </StepBody>
    );
  }

  return (
    <StepBody>
      <StepHeading
        headingRef={headingRef}
        progress={progress}
        title={t("onboarding.fetch.title")}
        body={t("onboarding.fetch.body")}
      />
      <OnboardingPreview
        loading
        // The place line names the city once one is chosen or found.
        placeNote={
          stage === FETCH_STAGE.LOCATING_DEVICE ? t("onboarding.fetch.locatingDevice") : undefined
        }
        timesNote={
          stage === FETCH_STAGE.LOADING_TIMES ? t("onboarding.fetch.loadingTimes") : undefined
        }
      />
      <ChooseCityButton onPress={chooseCity} />
    </StepBody>
  );
};
