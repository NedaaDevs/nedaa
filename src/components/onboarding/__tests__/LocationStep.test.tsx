import React from "react";
import renderer, { act } from "react-test-renderer";

import LocationStep from "@/components/onboarding/steps/LocationStep";
import { requestLocationPermission } from "@/utils/location";

// jest.mock factories are hoisted above imports, so they may only close over variables
// whose names begin with `mock`. These stubs render nothing and simply record that they
// were mounted, which is all the step's mode transitions need to be observable.
const mockPicker = {
  rendered: false,
  onDone: undefined as (() => void) | undefined,
  onEnterCoordinates: undefined as (() => void) | undefined,
};
const mockCoordinates = { rendered: false };

jest.mock("@/utils/location", () => ({
  requestLocationPermission: jest.fn(),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("lucide-react-native", () => ({
  MapPin: () => null,
  ChevronLeft: () => null,
}));

// Tamagui ships ESM that jest does not transform, so the primitives are stubbed down to
// their children — the same approach the other screen tests take.
jest.mock("@/components/ui/box", () => ({
  Box: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
jest.mock("@/components/ui/vstack", () => ({
  VStack: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
jest.mock("@/components/ui/hstack", () => ({
  HStack: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
jest.mock("@/components/ui/text", () => ({
  Text: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
jest.mock("@/components/ui/icon", () => ({ Icon: () => null }));
jest.mock("@/components/ui/pressable", () => ({
  Pressable: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
jest.mock("@/components/ui/button", () => {
  const ButtonText = ({ children }: { children?: React.ReactNode }) => children ?? null;
  const Button = ({ children }: { children?: React.ReactNode }) => children ?? null;
  Button.Text = ButtonText;
  return { Button };
});

jest.mock("@/components/location/CityPicker", () => {
  const CityPickerStub = ({
    onDone,
    onEnterCoordinates,
  }: {
    onDone: () => void;
    onEnterCoordinates?: () => void;
  }) => {
    mockPicker.rendered = true;
    mockPicker.onDone = onDone;
    mockPicker.onEnterCoordinates = onEnterCoordinates;
    return null;
  };
  return { __esModule: true, default: CityPickerStub };
});

jest.mock("@/components/location/CoordinateEntry", () => {
  const CoordinateEntryStub = () => {
    mockCoordinates.rendered = true;
    return null;
  };
  return { __esModule: true, default: CoordinateEntryStub };
});

const mockRequestPermission = requestLocationPermission as jest.Mock;

const pressableWithLabel = (tree: renderer.ReactTestRenderer, label: string) =>
  tree.root.findAll(
    (node) => node.props?.accessibilityLabel === label && typeof node.props?.onPress === "function"
  )[0];

const visibleText = (tree: renderer.ReactTestRenderer) =>
  tree.root
    .findAll((node) => typeof node.props?.children === "string")
    .map((node) => node.props.children as string);

const render = async () => {
  const onNext = jest.fn();
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<LocationStep onNext={onNext} />);
    await Promise.resolve();
  });
  return { tree, onNext };
};

const press = async (tree: renderer.ReactTestRenderer, label: string) => {
  await act(async () => {
    pressableWithLabel(tree, label).props.onPress();
  });
};

describe("onboarding location step", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPicker.rendered = false;
    mockPicker.onDone = undefined;
    mockPicker.onEnterCoordinates = undefined;
    mockCoordinates.rendered = false;
  });

  test("offers the manual path alongside sharing location", async () => {
    const { tree } = await render();
    expect(visibleText(tree)).toContain("onboarding.location.chooseCity");
  });

  test("advances when the permission is granted", async () => {
    mockRequestPermission.mockResolvedValue({ granted: true });
    const { tree, onNext } = await render();

    await press(tree, "onboarding.location.allow");

    expect(onNext).toHaveBeenCalled();
  });

  test("does not advance when the permission is declined", async () => {
    mockRequestPermission.mockResolvedValue({ granted: false });
    const { tree, onNext } = await render();

    await press(tree, "onboarding.location.allow");

    // Advancing here would leave the user on Makkah's prayer times with no explanation.
    expect(onNext).not.toHaveBeenCalled();
    expect(visibleText(tree)).toContain("onboarding.location.deniedTitle");
  });

  test("offers both the picker and an explicit skip after a decline", async () => {
    mockRequestPermission.mockResolvedValue({ granted: false });
    const { tree } = await render();

    await press(tree, "onboarding.location.allow");

    expect(visibleText(tree)).toContain("onboarding.location.chooseCity");
    expect(visibleText(tree)).toContain("onboarding.location.skip");
  });

  test("opens the picker without ever requesting the permission", async () => {
    const { tree } = await render();

    await press(tree, "a11y.onboarding.location.chooseCity");

    expect(mockPicker.rendered).toBe(true);
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  test("advances once a city has been chosen", async () => {
    const { tree, onNext } = await render();

    await press(tree, "a11y.onboarding.location.chooseCity");
    await act(async () => {
      mockPicker.onDone?.();
    });

    expect(onNext).toHaveBeenCalled();
  });

  test("skipping after a decline advances without a location", async () => {
    mockRequestPermission.mockResolvedValue({ granted: false });
    const { tree, onNext } = await render();

    await press(tree, "onboarding.location.allow");
    await press(tree, "a11y.onboarding.location.skip");

    expect(onNext).toHaveBeenCalled();
  });

  test("coordinate entry is reachable from the picker", async () => {
    const { tree } = await render();

    await press(tree, "a11y.onboarding.location.chooseCity");
    await act(async () => {
      mockPicker.onEnterCoordinates?.();
    });

    expect(mockCoordinates.rendered).toBe(true);
  });

  test("backing out of coordinate entry returns to the picker, not the prompt", async () => {
    const { tree } = await render();

    await press(tree, "a11y.onboarding.location.chooseCity");
    await act(async () => {
      mockPicker.onEnterCoordinates?.();
    });
    mockPicker.rendered = false;
    await press(tree, "a11y.back");

    expect(mockPicker.rendered).toBe(true);
  });

  test("the picker can be backed out of, returning to the prompt", async () => {
    const { tree } = await render();

    await press(tree, "a11y.onboarding.location.chooseCity");
    await press(tree, "a11y.back");

    expect(visibleText(tree)).toContain("onboarding.location.title");
  });
});
