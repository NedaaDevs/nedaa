import { screen, userEvent } from "@testing-library/react-native";
import { I18nManager, Platform } from "react-native";

import { Switch } from "@/components/ui/switch";
import { AppDirection, PlatformType, type PlatformTypeValue } from "@/enums/app";
import { type HostElement, styleOf } from "@/test-helpers/text";
import { renderWithTheme } from "@/test-helpers/theme";

const LABEL = "Show seconds";

const DIRECTIONS = Object.values(AppDirection);
const PAIRINGS = DIRECTIONS.flatMap((phone) => DIRECTIONS.map((app) => ({ phone, app })));
type Pairing = (typeof PAIRINGS)[number];
const isRtl = (direction: AppDirection) => direction === AppDirection.RTL;

// The side each platform draws ON at with no transform: iOS by the phone's
// direction, Android by the app's.
const DRAWS_RTL: Record<PlatformTypeValue, (pairing: Pairing) => boolean> = {
  [PlatformType.IOS]: ({ phone }) => isRtl(phone),
  [PlatformType.ANDROID]: ({ app }) => isRtl(app),
};

const isMirrored = (element: HostElement): boolean => {
  const { transform } = styleOf(element) ?? {};
  return (
    Array.isArray(transform) &&
    transform.some((step) => "scaleX" in step && Number(step.scaleX) < 0)
  );
};

describe("Switch", () => {
  it("reaches the screen reader with its name and state", async () => {
    await renderWithTheme(
      <Switch value accessibilityLabel={LABEL} accessibilityHint="Counts to the second" />
    );

    const toggle = screen.getByRole("switch", { name: LABEL });
    expect(toggle.props.accessibilityHint).toBe("Counts to the second");
    expect(toggle).toBeChecked();
  });

  it("stays still when disabled", async () => {
    const onValueChange = jest.fn();
    await renderWithTheme(
      <Switch value={false} disabled accessibilityLabel={LABEL} onValueChange={onValueChange} />
    );

    expect(screen.getByRole("switch", { name: LABEL }).props.disabled).toBe(true);
    await userEvent.press(screen.getByRole("switch", { name: LABEL }));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  // tsc fails the build if the directive below stops being needed.
  it("refuses a caller transform, which would drop the size and the mirror", () => {
    const withTransform = () => (
      <Switch
        accessibilityLabel={LABEL}
        // @ts-expect-error the size and the mirror own the transform
        style={{ transform: [{ scale: 2 }] }}
      />
    );

    expect(withTransform).toEqual(expect.any(Function));
  });
});

describe.each(Object.values(PlatformType))("Switch direction on %s", (os) => {
  afterEach(() => jest.restoreAllMocks());

  it.each(PAIRINGS)("puts ON at the app's end: phone $phone, app $app", async (pairing) => {
    jest.replaceProperty(Platform, "OS", os);
    jest.replaceProperty(I18nManager, "isRTL", isRtl(pairing.phone));
    await renderWithTheme(<Switch value accessibilityLabel={LABEL} />, {
      isRTL: isRtl(pairing.app),
    });

    const mirrored = isMirrored(screen.getByLabelText(LABEL));
    const drawnRtl = DRAWS_RTL[os](pairing) !== mirrored;
    expect(drawnRtl).toBe(isRtl(pairing.app));
  });
});
