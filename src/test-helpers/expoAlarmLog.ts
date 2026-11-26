// A logging expo-alarm; a suite's jest.mock factory returns
// jest.requireActual("@/test-helpers/expoAlarmLog").expoAlarmLogModule.

// Every native call as [name, args], in order.
export const nativeCalls: [string, unknown[]][] = [];

// Per function: a value, or a function of the call's args. An async function
// defaults to true; a sync one answers as the real module does without native.
export const nativeResults: Record<string, unknown> = {};

export const resetNativeLog = (): void => {
  nativeCalls.length = 0;
  for (const name of Object.keys(nativeResults)) delete nativeResults[name];
};

export const argsOf = (name: string): unknown[][] =>
  nativeCalls.filter(([called]) => called === name).map(([, args]) => args);

const answer = (name: string, args: unknown[], fallback: unknown): unknown => {
  const stub = name in nativeResults ? nativeResults[name] : fallback;
  return typeof stub === "function" ? stub(...args) : stub;
};

// The real call tells a sync read from an async one; a sync read stays sync,
// so a falsy answer is not hidden behind a truthy promise.
const logged =
  (name: string, real: (...args: unknown[]) => unknown) =>
  (...args: unknown[]): unknown => {
    nativeCalls.push([name, args]);
    const realResult = real(...args);
    if (realResult instanceof Promise) {
      realResult.catch(() => undefined);
      return Promise.resolve(answer(name, args, true));
    }
    return answer(name, args, realResult);
  };

// Constants such as ALARM_OUTCOME come from the real module.
export const expoAlarmLogModule = new Proxy(
  {},
  {
    get: (_target, property) => {
      if (property === "__esModule") return true;
      const name = String(property);
      const real = (jest.requireActual("expo-alarm") as Record<string, unknown>)[name];
      if (typeof real === "function") return logged(name, real as (...args: unknown[]) => unknown);
      return real !== undefined ? real : logged(name, () => Promise.resolve());
    },
  }
);
