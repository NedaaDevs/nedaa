// A logging expo-alarm; a suite's jest.mock factory returns
// jest.requireActual("@/test-helpers/expoAlarmLog").expoAlarmLogModule.

// Every native call as [name, args], in order.
export const nativeCalls: [string, unknown[]][] = [];

// Per function: a value, or a function of the call's args. Default true.
export const nativeResults: Record<string, unknown> = {};

export const resetNativeLog = (): void => {
  nativeCalls.length = 0;
  for (const name of Object.keys(nativeResults)) delete nativeResults[name];
};

export const argsOf = (name: string): unknown[][] =>
  nativeCalls.filter(([called]) => called === name).map(([, args]) => args);

const logged =
  (name: string) =>
  (...args: unknown[]): Promise<unknown> => {
    nativeCalls.push([name, args]);
    const stub = name in nativeResults ? nativeResults[name] : true;
    return Promise.resolve(typeof stub === "function" ? stub(...args) : stub);
  };

// Constants such as ALARM_OUTCOME come from the real module.
export const expoAlarmLogModule = new Proxy(
  {},
  {
    get: (_target, property) => {
      if (property === "__esModule") return true;
      const name = String(property);
      const real = (jest.requireActual("expo-alarm") as Record<string, unknown>)[name];
      return real !== undefined && typeof real !== "function" ? real : logged(name);
    },
  }
);
