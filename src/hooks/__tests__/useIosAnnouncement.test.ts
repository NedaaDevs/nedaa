import { AccessibilityInfo, Platform } from "react-native";
import { renderHook } from "@testing-library/react-native";

import { PlatformType } from "@/enums/app";
import { useIosAnnouncement } from "@/hooks/useIosAnnouncement";

const PLATFORM = Platform.OS;
const FIRST = "first message";
const SECOND = "second message";
const announce = () => jest.mocked(AccessibilityInfo.announceForAccessibility);
/** The hook under a caller that hands it `message`, then others on rerender. */
const announcing = (message: string | null) =>
  renderHook((props: { message: string | null }) => useIosAnnouncement(props.message), {
    initialProps: { message },
  });

beforeEach(() => announce().mockClear());
afterEach(() => {
  Platform.OS = PLATFORM;
});

describe("on iOS", () => {
  beforeEach(() => {
    Platform.OS = PlatformType.IOS;
  });

  it("says a message once, and again each time it changes", async () => {
    const hook = await announcing(FIRST);
    await hook.rerender({ message: FIRST });
    expect(announce().mock.calls).toEqual([[FIRST]]);

    await hook.rerender({ message: SECOND });
    expect(announce().mock.calls).toEqual([[FIRST], [SECOND]]);
  });

  // Two surfaces can draw one value, such as a run's step; it is said once.
  it("says a message another mounted caller holds only once", async () => {
    const first = await announcing(FIRST);
    const second = await announcing(FIRST);
    expect(announce().mock.calls).toEqual([[FIRST]]);

    await first.rerender({ message: SECOND });
    await second.rerender({ message: SECOND });
    expect(announce().mock.calls).toEqual([[FIRST], [SECOND]]);
  });

  it("says a message again once no caller holds it", async () => {
    const hook = await announcing(FIRST);
    await hook.unmount();

    await announcing(FIRST);

    expect(announce().mock.calls).toEqual([[FIRST], [FIRST]]);
  });

  it("says nothing for no message", async () => {
    const hook = await announcing(null);
    await hook.rerender({ message: null });

    expect(announce()).not.toHaveBeenCalled();
  });
});

// Android reads the caller's live region instead.
it("says nothing on Android", async () => {
  Platform.OS = PlatformType.ANDROID;
  const hook = await announcing(FIRST);
  await hook.rerender({ message: SECOND });

  expect(announce()).not.toHaveBeenCalled();
});
