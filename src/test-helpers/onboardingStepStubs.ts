import { createElement as h, useEffect, type ComponentType } from "react";
import { Text, View } from "react-native";
import { act, fireEvent, screen } from "@testing-library/react-native";

import type { StepProps } from "@/components/onboarding/flow/types";
import { ONBOARDING_STEP, type OnboardingStepId } from "@/constants/Onboarding";

/** The testID each stub draws: this prefix, then its step's id. */
export const STEP_STUB_PREFIX = "step-";
/** The testID of each stub's heading: this prefix, then its step's id. */
export const STEP_HEADING_STUB_PREFIX = "heading-";

/** The props each step last rendered with. */
export const stubProps: Partial<Record<OnboardingStepId, StepProps>> = {};
/** How many times each step mounted. */
export const stubMounts: Partial<Record<OnboardingStepId, number>> = {};
/** Steps a test draws with their real component, inside the stub's testID. */
export const realSteps = new Map<OnboardingStepId, ComponentType<StepProps>>();

const stub = (id: OnboardingStepId) => {
  const StepStub = (props: StepProps) => {
    stubProps[id] = props;
    useEffect(() => {
      stubMounts[id] = (stubMounts[id] ?? 0) + 1;
    }, []);
    const Real = realSteps.get(id);
    if (Real) return h(View, { testID: `${STEP_STUB_PREFIX}${id}` }, h(Real, props));
    return h(
      View,
      {
        ref: props.headingRef,
        testID: `${STEP_HEADING_STUB_PREFIX}${id}`,
        accessible: true,
        onLayout: props.onHeadingLayout,
      },
      h(Text, { testID: `${STEP_STUB_PREFIX}${id}` }, id)
    );
  };
  return StepStub;
};

/** Stands in for the step registry: each id draws its stub. */
export const STEP_COMPONENT = Object.fromEntries(
  Object.values(ONBOARDING_STEP).map((id) => [id, stub(id)])
);

/** The id of the step on screen. */
export const currentStep = () =>
  String(screen.getByTestId(new RegExp(`^${STEP_STUB_PREFIX}`)).props.testID).slice(
    STEP_STUB_PREFIX.length
  );

/** Lays out `id`'s stub heading, as the native view reports it once drawn. */
export const layOutHeading = (id: OnboardingStepId) =>
  act(async () => {
    fireEvent(screen.getByTestId(`${STEP_HEADING_STUB_PREFIX}${id}`), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 44 } },
    });
  });

/** The props `id` last rendered with; throws when it never rendered. */
export const propsOf = (id: OnboardingStepId) => {
  const found = stubProps[id];
  if (!found) throw new Error(`step ${id} has not rendered`);
  return found;
};

/** Forgets every render and mount, and draws every step as its stub. */
export const resetStepStubs = () => {
  for (const id of Object.values(ONBOARDING_STEP)) {
    delete stubProps[id];
    delete stubMounts[id];
  }
  realSteps.clear();
};
