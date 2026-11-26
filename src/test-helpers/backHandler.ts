import { BackHandler } from "react-native";
import { act } from "@testing-library/react-native";

type BackPressHandler = Parameters<typeof BackHandler.addEventListener>[1];

const BACK_PRESS: Parameters<BackPressHandler>[0] = { type: "hardwareBackPress", timeStamp: 0 };

// Android's back, which the iOS preset never sends. The newest handler goes
// first, and the press resolves to whether one took it.
export const androidBack = () => {
  const handlers = new Set<BackPressHandler>();
  jest.spyOn(BackHandler, "addEventListener").mockImplementation((_, handler) => {
    handlers.add(handler);
    return { remove: () => handlers.delete(handler) };
  });
  return async () => {
    let handled = false;
    await act(async () => {
      handled = [...handlers].reverse().some((handler) => handler(BACK_PRESS));
    });
    return handled;
  };
};
