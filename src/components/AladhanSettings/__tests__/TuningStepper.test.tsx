import React from "react";
import renderer, { act } from "react-test-renderer";

import { TuningStepper } from "@/components/AladhanSettings/TuningStepper";
import { TUNING_LIMIT } from "@/components/AladhanSettings/tuning";

jest.mock("@/components/ui/hstack", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View: RNView } = require("react-native");
  return { HStack: RNView };
});

jest.mock("@/components/ui/vstack", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View: RNView } = require("react-native");
  return { VStack: RNView };
});

jest.mock("@/components/ui/text", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text: RNText } = require("react-native");
  return { Text: RNText };
});

jest.mock("@/components/ui/pressable", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View: RNView } = require("react-native");
  return { Pressable: RNView };
});

jest.mock("@/utils/number", () => ({ formatNumberToLocale: (s: string) => s }));

jest.mock("@/components/ui/icon", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View: RNView } = require("react-native");
  return { Icon: RNView };
});

const render = (props: Partial<React.ComponentProps<typeof TuningStepper>> = {}) => {
  const onChange = jest.fn();
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<TuningStepper label="Fajr" value={0} onChange={onChange} {...props} />);
  });
  return { tree, onChange };
};

const press = (tree: renderer.ReactTestRenderer, testID: string) => {
  act(() => {
    tree.root.findByProps({ testID }).props.onPress();
  });
};

describe("TuningStepper", () => {
  test("adds a minute when incremented", () => {
    const { tree, onChange } = render({ value: 2 });

    press(tree, "tuning-increment");

    expect(onChange).toHaveBeenCalledWith(3);
  });

  test("removes a minute when decremented", () => {
    const { tree, onChange } = render({ value: 2 });

    press(tree, "tuning-decrement");

    expect(onChange).toHaveBeenCalledWith(1);
  });

  test("crosses zero into negative offsets", () => {
    const { tree, onChange } = render({ value: 0 });

    press(tree, "tuning-decrement");

    expect(onChange).toHaveBeenCalledWith(-1);
  });

  test("will not go past the upper limit", () => {
    const { tree, onChange } = render({ value: TUNING_LIMIT });

    press(tree, "tuning-increment");

    expect(onChange).not.toHaveBeenCalled();
  });

  test("will not go past the lower limit", () => {
    const { tree, onChange } = render({ value: -TUNING_LIMIT });

    press(tree, "tuning-decrement");

    expect(onChange).not.toHaveBeenCalled();
  });

  test("exposes the offset to assistive tech as an adjustable value", () => {
    const { tree } = render({ value: 4 });

    const stepper = tree.root.findByProps({ testID: "tuning-stepper" });

    expect(stepper.props.accessibilityRole).toBe("adjustable");
    expect(stepper.props.accessibilityValue).toEqual({
      min: -TUNING_LIMIT,
      max: TUNING_LIMIT,
      now: 4,
    });
  });

  test("adjusts via the screen reader's increment action", () => {
    const { tree, onChange } = render({ value: 1 });

    act(() => {
      tree.root
        .findByProps({ testID: "tuning-stepper" })
        .props.onAccessibilityAction({ nativeEvent: { actionName: "increment" } });
    });

    expect(onChange).toHaveBeenCalledWith(2);
  });

  test("adjusts via the screen reader's decrement action", () => {
    const { tree, onChange } = render({ value: 1 });

    act(() => {
      tree.root
        .findByProps({ testID: "tuning-stepper" })
        .props.onAccessibilityAction({ nativeEvent: { actionName: "decrement" } });
    });

    expect(onChange).toHaveBeenCalledWith(0);
  });

  test("hides the buttons from the reader, which drives the row instead", () => {
    const { tree } = render();

    expect(tree.root.findByProps({ testID: "tuning-increment" }).props.accessible).toBe(false);
  });

  test("lays the controls out horizontally under the label", () => {
    const { tree } = render();

    expect(tree.root.findByProps({ testID: "tuning-controls" }).props.flexDirection).toBe("row");
  });

  test("marks the limit-reached control as disabled for assistive tech", () => {
    const { tree } = render({ value: TUNING_LIMIT });

    expect(tree.root.findByProps({ testID: "tuning-increment" }).props.accessibilityState).toEqual({
      disabled: true,
    });
  });
});
