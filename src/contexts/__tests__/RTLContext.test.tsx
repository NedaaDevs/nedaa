import { I18nManager, Text } from "react-native";
import { act, render } from "@testing-library/react-native";

import { RTLProvider, useRTL } from "@/contexts/RTLContext";
import { AppDirection, AppLocale } from "@/enums/app";
import { useAppStore } from "@/stores/app";

const Probe = () => {
  const { isRTL, direction } = useRTL();
  return <Text>{`${direction}:${isRTL}`}</Text>;
};

const mountProvider = () =>
  render(
    <RTLProvider>
      <Probe />
    </RTLProvider>
  );

describe("RTLProvider", () => {
  let allowRTL: jest.SpyInstance;
  let forceRTL: jest.SpyInstance;

  beforeEach(() => {
    allowRTL = jest.spyOn(I18nManager, "allowRTL").mockImplementation(() => {});
    forceRTL = jest.spyOn(I18nManager, "forceRTL").mockImplementation(() => {});
    useAppStore.setState({ locale: AppLocale.EN });
  });

  afterEach(() => jest.restoreAllMocks());

  it("reports the app locale's direction through useRTL", async () => {
    const view = await mountProvider();
    expect(view.getByText(`${AppDirection.LTR}:false`)).toBeTruthy();

    await act(async () => useAppStore.setState({ locale: AppLocale.AR }));
    expect(view.getByText(`${AppDirection.RTL}:true`)).toBeTruthy();

    await act(async () => useAppStore.setState({ locale: AppLocale.EN }));
    expect(view.getByText(`${AppDirection.LTR}:false`)).toBeTruthy();
  });

  it("lays its root out in the app locale's direction", async () => {
    const view = await mountProvider();
    expect(view.root).toHaveStyle({ direction: AppDirection.LTR });

    await act(async () => useAppStore.setState({ locale: AppLocale.UR }));
    expect(view.root).toHaveStyle({ direction: AppDirection.RTL });
  });

  // The phone's language owns the native direction.
  it("leaves the native direction alone on mount and on every language change", async () => {
    useAppStore.setState({ locale: AppLocale.AR });
    await mountProvider();
    expect(allowRTL).not.toHaveBeenCalled();
    expect(forceRTL).not.toHaveBeenCalled();

    await act(async () => useAppStore.setState({ locale: AppLocale.EN }));
    await act(async () => useAppStore.setState({ locale: AppLocale.UR }));

    expect(allowRTL).not.toHaveBeenCalled();
    expect(forceRTL).not.toHaveBeenCalled();
  });
});
