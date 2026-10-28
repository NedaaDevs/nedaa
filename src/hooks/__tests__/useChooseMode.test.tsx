import { Appearance } from "react-native";
import { renderHook } from "@testing-library/react-native";

import { NATIVE_SCHEME } from "@/constants/Appearance";
import { PHASE } from "@/constants/Phase";
import { LivePhaseContext } from "@/contexts/LivePhaseContext";
import { PhaseContext } from "@/contexts/PhaseContext";
import { AppMode } from "@/enums/app";
import { useChooseMode } from "@/hooks/useChooseMode";
import { useAppStore } from "@/stores/app";

describe("useChooseMode", () => {
  beforeEach(() => {
    useAppStore.setState({ mode: AppMode.LIGHT });
    // The phone already reports the live pin, so the choice settles at once.
    jest.spyOn(Appearance, "getColorScheme").mockReturnValue(NATIVE_SCHEME.LIGHT);
    jest.spyOn(Appearance, "setColorScheme").mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  // A day run provides its own phase; the phone follows the real one.
  it("pins the live phase while a run draws another", async () => {
    const { result } = await renderHook(() => useChooseMode(), {
      wrapper: ({ children }) => (
        <LivePhaseContext value={PHASE.DAY}>
          <PhaseContext value={PHASE.NIGHT}>{children}</PhaseContext>
        </LivePhaseContext>
      ),
    });

    await result.current(AppMode.ADAPTIVE);

    expect(Appearance.setColorScheme).toHaveBeenCalledWith(NATIVE_SCHEME.LIGHT);
    expect(Appearance.setColorScheme).not.toHaveBeenCalledWith(NATIVE_SCHEME.DARK);
    expect(useAppStore.getState().mode).toBe(AppMode.ADAPTIVE);
  });
});
